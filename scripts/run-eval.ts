import { pool } from "@/db";
import OpenAI from "openai";
import { env } from "@/config/env";
import { retrieveTopK } from "@/ai/retrieval";
import { calculateCost } from "@/lib/cost-tracking";

// Create OpenAI client directly for embeddings
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

interface EvalCase {
  id: number;
  question: string;
  expectedAnswer: string;
  expectedContexts: string[];
}

/**
 * Calculate semantic similarity between two texts using embeddings
 */
async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  const [emb1, emb2] = await Promise.all([
    openai.embeddings.create({ model: "text-embedding-3-small", input: text1 }),
    openai.embeddings.create({ model: "text-embedding-3-small", input: text2 }),
  ]);

  const vec1 = emb1.data[0].embedding;
  const vec2 = emb2.data[0].embedding;

  // Cosine similarity
  const dotProduct = vec1.reduce((sum: number, val: number, i: number) => sum + val * vec2[i], 0);
  const mag1 = Math.sqrt(vec1.reduce((sum: number, val: number) => sum + val * val, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum: number, val: number) => sum + val * val, 0));

  return dotProduct / (mag1 * mag2);
}

/**
 * Evaluate a single test case
 */
async function evaluateCase(
  testCase: EvalCase,
  config: { model: string; k: number }
): Promise<{
  score: number;
  metrics: any;
  actualAnswer: string;
  latencyMs: number;
  costUsd: number;
}> {
  const startTime = Date.now();

  // Retrieve contexts
  const contexts = await retrieveTopK(testCase.question, config.k);

  // Build prompt
  const systemPrompt = `You are a medical documentation assistant. Use only the provided context to answer questions concisely.

Context:
${contexts.map((c) => c.content).join("\n\n")}`;

  // Generate answer
  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: testCase.question },
    ],
    temperature: 0,
    max_tokens: 500,
    stream: false,
  });

  const actualAnswer = response.choices[0].message.content || "";
  const latencyMs = Date.now() - startTime;

  // Calculate cost
  const cost = calculateCost(
    config.model,
    response.usage?.prompt_tokens || 0,
    response.usage?.completion_tokens || 0
  );

  // Compute metrics
  const semanticScore = await semanticSimilarity(
    actualAnswer,
    testCase.expectedAnswer
  );

  // Check if expected keywords are present (simple containment check)
  const expectedKeywords = testCase.expectedAnswer
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const actualLower = actualAnswer.toLowerCase();
  const keywordMatches = expectedKeywords.filter((kw) =>
    actualLower.includes(kw)
  ).length;
  const keywordScore = expectedKeywords.length > 0
    ? keywordMatches / expectedKeywords.length
    : 0;

  // Combined score (weighted average)
  const finalScore = semanticScore * 0.7 + keywordScore * 0.3;

  return {
    score: parseFloat(finalScore.toFixed(2)),
    metrics: {
      semanticSimilarity: parseFloat(semanticScore.toFixed(2)),
      keywordMatch: parseFloat(keywordScore.toFixed(2)),
      contextsRetrieved: contexts.length,
    },
    actualAnswer,
    latencyMs,
    costUsd: cost.costUsd,
  };
}

/**
 * Run evaluation on a dataset
 */
async function runEvaluation(
  datasetName: string,
  config: { model: string; k: number }
) {
  console.log(
    `\n🧪 Running evaluation: ${datasetName} (model=${config.model}, k=${config.k})\n`
  );

  // Get dataset
  const { rows: datasetRows } = await pool.query(
    "SELECT id FROM eval_datasets WHERE name = $1",
    [datasetName]
  );

  if (datasetRows.length === 0) {
    throw new Error(`Dataset not found: ${datasetName}`);
  }

  const datasetId = datasetRows[0].id;

  // Get test cases
  const { rows: caseRows } = await pool.query(
    "SELECT id, question, expected_answer, expected_contexts FROM eval_cases WHERE dataset_id = $1",
    [datasetId]
  );

  if (caseRows.length === 0) {
    throw new Error(`No test cases found for dataset: ${datasetName}`);
  }

  // Create eval run
  const { rows: runRows } = await pool.query(
    "INSERT INTO eval_runs (dataset_id, config) VALUES ($1, $2) RETURNING id",
    [datasetId, JSON.stringify(config)]
  );
  const runId = runRows[0].id;

  // Run each test case
  const results = [];
  let totalCost = 0;
  let passedCases = 0;

  for (let i = 0; i < caseRows.length; i++) {
    const testCase: EvalCase = {
      id: caseRows[i].id,
      question: caseRows[i].question,
      expectedAnswer: caseRows[i].expected_answer,
      expectedContexts: caseRows[i].expected_contexts,
    };

    process.stdout.write(`[${i + 1}/${caseRows.length}] Evaluating... `);

    const result = await evaluateCase(testCase, config);
    results.push(result);
    totalCost += result.costUsd;

    if (result.score >= 0.7) {
      passedCases++;
    }

    // Store result
    await pool.query(
      `INSERT INTO eval_results (run_id, case_id, actual_answer, score, metrics, latency_ms, cost_usd) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        runId,
        testCase.id,
        result.actualAnswer,
        result.score,
        JSON.stringify(result.metrics),
        result.latencyMs,
        result.costUsd,
      ]
    );

    console.log(
      `✓ Score: ${result.score} (${result.latencyMs}ms, $${result.costUsd.toFixed(6)})`
    );
  }

  // Calculate summary
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  // Update eval run
  await pool.query(
    `UPDATE eval_runs 
     SET total_cases = $1, passed_cases = $2, avg_score = $3, total_cost_usd = $4, completed_at = NOW() 
     WHERE id = $5`,
    [results.length, passedCases, avgScore.toFixed(2), totalCost.toFixed(4), runId]
  );

  console.log(`\n📊 Results:`);
  console.log(`   Average Score: ${avgScore.toFixed(2)}`);
  console.log(`   Passed: ${passedCases}/${results.length} (${((passedCases / results.length) * 100).toFixed(1)}%)`);
  console.log(`   Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`   Run ID: ${runId}\n`);
}

async function main() {
  const datasetName = process.argv[2] || "clinical-qa-v1";
  const model = process.argv[3] || "gpt-4o-mini";
  const k = parseInt(process.argv[4] || "4", 10);

  await runEvaluation(datasetName, { model, k });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

