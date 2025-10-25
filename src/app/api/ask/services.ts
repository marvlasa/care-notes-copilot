/**
 * Business logic services for /api/ask
 * Groups related functionality into cohesive units
 */

import { NextRequest } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { calculateCost, recordQueryCost } from "@/lib/cost-tracking";
import { pool } from "@/db";
import { getLangfuse } from "@/obs/langfuse";
import { classifyIntent } from "@/ai/intent";
import { retrieveTopK, RetrievalResult } from "@/ai/retrieval";
import { env } from "@/config/env";
import { isUsingOllama } from "@/ai/openai";
import type { AskRequest, AskContext, RateLimitResult, QueryMetrics } from "./types";

// Default model based on whether we're using Ollama or OpenAI
const DEFAULT_MODEL = isUsingOllama ? env.OLLAMA_MODEL : "gpt-4o-mini";

/**
 * Request validation and normalization
 */
export class RequestValidator {
  static validate(body: unknown): AskRequest {
    const req = body as Partial<AskRequest>;
    
    if (!req.question || typeof req.question !== "string" || req.question.trim().length === 0) {
      throw new Error("Invalid question: must be a non-empty string");
    }

    return {
      question: req.question.trim(),
      sessionId: req.sessionId || undefined,
      model: req.model || DEFAULT_MODEL,
      k: Math.min(Math.max(req.k || 4, 1), 20), // Clamp between 1-20
    };
  }

  static extractIP(req: NextRequest): string {
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    return forwarded?.split(",")[0]?.trim() || realIp || "unknown";
  }
}

/**
 * Authentication and authorization
 */
export class AuthService {
  static async createContext(req: NextRequest, validated: AskRequest): Promise<AskContext> {
    const user = await authenticateRequest(req);
    
    return {
      userId: user?.userId || null,
      sessionId: validated.sessionId ?? null,
      question: validated.question,
      model: validated.model ?? DEFAULT_MODEL,
      k: validated.k ?? 4, // default/fallback value to satisfy type
      ip: RequestValidator.extractIP(req),
      userAgent: req.headers.get("user-agent") ?? "",
    };
  }

  static getRateLimitKey(ctx: AskContext): string {
    return ctx.userId ? `user:${ctx.userId}` : `ip:${ctx.ip}`;
  }
}

/**
 * Rate limiting service
 */
export class RateLimitService {
  static async check(key: string): Promise<RateLimitResult> {
    return await checkRateLimit(key);
  }
}

/**
 * Prompt building and token estimation
 */
export class PromptService {
  static buildMessages(question: string, contexts: RetrievalResult[]): ChatCompletionMessageParam[] {
    const systemPrompt = `You are a medical documentation assistant for healthcare professionals.

IMPORTANT GUIDELINES:
- Use ONLY the provided clinical note context to answer questions
- If the context doesn't contain the answer, clearly state "I don't have enough information"
- Be concise, accurate, and clinically relevant
- Never make up information or provide medical advice beyond what's in the notes
- Cite which patient/note you're referencing when possible

Context from clinical notes:
${contexts.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n")}`;

    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ];
  }

  static estimateTokens(messages: ChatCompletionMessageParam[]): number {
    const text = messages.map(m => m.content).join("");
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 chars
  }
}

/**
 * Query persistence
 */
export class QueryRepository {
  static async create(ctx: AskContext, intent: string, contextsCount: number): Promise<number> {
    const { rows } = await pool.query(
      `INSERT INTO queries 
       (user_id, session_id, question, intent, contexts_used, model_name, answer) 
       VALUES ($1, $2, $3, $4, $5, $6, '') 
       RETURNING id`,
      [ctx.userId, ctx.sessionId, ctx.question, intent, contextsCount, ctx.model]
    );
    return rows[0].id;
  }

  static async updateWithAnswer(queryId: number, answer: string, metrics: QueryMetrics, traceId?: string): Promise<void> {
    await pool.query(
      `UPDATE queries 
       SET answer = $1, latency_ms = $2, tokens_prompt = $3, 
           tokens_completion = $4, cost_usd = $5, trace_id = $6
       WHERE id = $7`,
      [answer, metrics.latencyMs, metrics.promptTokens, metrics.completionTokens, metrics.costUsd, traceId, queryId]
    );
  }

  static async updateWithError(queryId: number, error: Error): Promise<void> {
    await pool.query(
      "UPDATE queries SET error = $1 WHERE id = $2",
      [error.message, queryId]
    );
  }
}

/**
 * Observability and tracing
 */
export class TraceService {
  private trace: any;

  constructor(ctx: AskContext) {
    const langfuse = getLangfuse();
    this.trace = langfuse?.trace({
      name: "ask",
      userId: ctx.userId?.toString(),
      sessionId: ctx.sessionId || undefined,
      input: { question: ctx.question, model: ctx.model, k: ctx.k },
      metadata: { ip: ctx.ip, userAgent: ctx.userAgent },
    });
  }

  updateIntent(intent: { intent: string; confidence: number }): void {
    this.trace?.update({ metadata: { intent } });
  }

  updateCompletion(answer: string, contextsCount: number, metrics: QueryMetrics): void {
    this.trace?.update({
      output: {
        answer: answer.substring(0, 500),
        contextsRetrieved: contextsCount,
        latencyMs: metrics.latencyMs,
      },
      metadata: {
        cost: metrics.costUsd,
        tokens: metrics.promptTokens + metrics.completionTokens,
      },
    });
  }

  updateError(error: Error): void {
    this.trace?.update({
      output: { error: error.message },
    });
  }

  async finalize(): Promise<void> {
    if (this.trace && typeof (this.trace as any).finalize === "function") {
      await (this.trace as any).finalize();
    }
  }

  getTraceId(): string | undefined {
    return this.trace?.id;
  }
}

/**
 * Orchestrator - main business logic coordinator
 */
export class AskOrchestrator {
  private ctx: AskContext;
  private trace: TraceService;
  private queryId: number | null = null;

  constructor(ctx: AskContext) {
    this.ctx = ctx;
    this.trace = new TraceService(ctx);
  }

  async execute(): Promise<{
    messages: ChatCompletionMessageParam[];
    queryId: number;
    promptTokens: number;
    contextsCount: number;
    trace: TraceService;
  }> {
    // 1. Classify intent
    const intent = await classifyIntent(this.ctx.question);
    this.trace.updateIntent(intent);

    // 2. Retrieve contexts
    const contexts = await retrieveTopK(this.ctx.question, this.ctx.k, {
      useHybrid: true,
      useRerank: true,
      useCache: true,
    });

    // 3. Build prompt
    const messages = PromptService.buildMessages(this.ctx.question, contexts);
    const promptTokens = PromptService.estimateTokens(messages);

    // 4. Create query record
    this.queryId = await QueryRepository.create(this.ctx, intent.intent, contexts.length);

    return {
      messages,
      queryId: this.queryId,
      promptTokens,
      contextsCount: contexts.length,
      trace: this.trace,
    };
  }

  async handleCompletion(answer: string, startTime: number, promptTokens: number, completionTokens: number, contextsCount: number): Promise<void> {
    const latencyMs = Date.now() - startTime;
    const cost = calculateCost(this.ctx.model, promptTokens, completionTokens);
    
    const metrics: QueryMetrics = {
      latencyMs,
      promptTokens,
      completionTokens,
      costUsd: cost.costUsd,
    };

    // Update database
    if (this.queryId) {
      await QueryRepository.updateWithAnswer(
        this.queryId,
        answer,
        metrics,
        this.trace.getTraceId()
      );

      // Record cost
      if (this.ctx.userId) {
        await recordQueryCost(this.ctx.userId, this.queryId, cost);
      }
    }

    // Update trace
    this.trace.updateCompletion(answer, contextsCount, metrics);

    console.log(
      `[Ask] Query ${this.queryId} completed in ${latencyMs}ms, cost: $${metrics.costUsd.toFixed(6)}`
    );
  }

  async handleError(error: Error): Promise<void> {
    if (this.queryId) {
      await QueryRepository.updateWithError(this.queryId, error);
    }
    this.trace.updateError(error);
  }

  async finalize(): Promise<void> {
    await this.trace.finalize();
  }

  getQueryId(): number | null {
    return this.queryId;
  }
}

