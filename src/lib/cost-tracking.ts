import { pool } from "@/db";
import { env } from "@/config/env";

/**
 * OpenAI pricing as of 2025 (per 1M tokens)
 * Source: https://openai.com/api/pricing/
 */
const PRICING = {
  "gpt-4o-mini": {
    input: 0.15, // $0.15 per 1M input tokens
    output: 0.60, // $0.60 per 1M output tokens
  },
  "gpt-4o": {
    input: 2.50,
    output: 10.00,
  },
  "text-embedding-3-small": {
    input: 0.02, // $0.02 per 1M tokens
    output: 0,
  },
  "text-embedding-3-large": {
    input: 0.13,
    output: 0,
  },
};

export interface CostCalculation {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

/**
 * Calculate cost for a given model and token usage
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number = 0
): CostCalculation {
  const pricing = PRICING[model as keyof typeof PRICING];
  
  if (!pricing) {
    console.warn(`[Cost] Unknown model: ${model}, using default pricing`);
    const costUsd =
      (inputTokens * 0.1) / 1_000_000 + (outputTokens * 0.4) / 1_000_000;
    return { inputTokens, outputTokens, costUsd, model };
  }

  const costUsd =
    (inputTokens * pricing.input) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000;

  return {
    inputTokens,
    outputTokens,
    costUsd,
    model,
  };
}

/**
 * Track query cost in database
 */
export async function recordQueryCost(
  userId: number | null,
  queryId: number,
  cost: CostCalculation
): Promise<void> {
  try {
    // Update query record with cost
    await pool.query(
      `UPDATE queries 
       SET tokens_prompt = $1, tokens_completion = $2, cost_usd = $3 
       WHERE id = $4`,
      [cost.inputTokens, cost.outputTokens, cost.costUsd, queryId]
    );

    // Update cost summary if user is authenticated
    if (userId) {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      await pool.query(
        `
        INSERT INTO cost_summary (user_id, period_start, period_end, total_queries, total_tokens, total_cost_usd)
        VALUES ($1, $2, $3, 1, $4, $5)
        ON CONFLICT (user_id, period_start, period_end)
        DO UPDATE SET
          total_queries = cost_summary.total_queries + 1,
          total_tokens = cost_summary.total_tokens + $4,
          total_cost_usd = cost_summary.total_cost_usd + $5
        `,
        [
          userId,
          periodStart,
          periodEnd,
          cost.inputTokens + cost.outputTokens,
          cost.costUsd,
        ]
      );

      // Check if user exceeded threshold
      await checkCostAlert(userId);
    }
  } catch (error) {
    console.error("[Cost] Error recording cost:", error);
  }
}

/**
 * Check if user has exceeded cost threshold and alert
 */
async function checkCostAlert(userId: number): Promise<void> {
  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { rows } = await pool.query(
      `SELECT total_cost_usd FROM cost_summary 
       WHERE user_id = $1 AND period_start = $2 AND period_end = $3`,
      [userId, periodStart, periodEnd]
    );

    if (rows.length > 0) {
      const totalCost = parseFloat(rows[0].total_cost_usd);
      if (totalCost > env.COST_ALERT_THRESHOLD_USD) {
        console.warn(
          `[Cost] User ${userId} exceeded threshold: $${totalCost.toFixed(2)}`
        );
        // In production: send alert email, Slack notification, etc.
      }
    }
  } catch (error) {
    console.error("[Cost] Error checking alert:", error);
  }
}

/**
 * Get cost summary for a user
 */
export async function getUserCostSummary(
  userId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  totalQueries: number;
  totalTokens: number;
  totalCost: number;
} | null> {
  try {
    const { rows } = await pool.query(
      `SELECT total_queries, total_tokens, total_cost_usd 
       FROM cost_summary 
       WHERE user_id = $1 AND period_start = $2 AND period_end = $3`,
      [userId, periodStart, periodEnd]
    );

    if (rows.length === 0) {
      return { totalQueries: 0, totalTokens: 0, totalCost: 0 };
    }

    return {
      totalQueries: rows[0].total_queries,
      totalTokens: rows[0].total_tokens,
      totalCost: parseFloat(rows[0].total_cost_usd),
    };
  } catch (error) {
    console.error("[Cost] Error fetching summary:", error);
    return null;
  }
}

