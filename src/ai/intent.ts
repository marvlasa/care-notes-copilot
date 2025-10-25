import { openai, isUsingOllama } from "@/ai/openai";
import { env } from "@/config/env";
import { cacheGet, cacheSet, createCacheKey } from "@/lib/redis";

export type Intent =
  | "medical_query" // Questions about treatments, symptoms, medications
  | "document_search" // Looking for specific documents or notes
  | "data_analysis" // Asking for trends, patterns, statistics
  | "admin" // Administrative tasks
  | "unclear"; // Can't determine intent

export interface IntentClassification {
  intent: Intent;
  confidence: number;
  reasoning?: string;
}

/**
 * Classify user query intent using LLM
 */
export async function classifyIntent(
  query: string
): Promise<IntentClassification> {
  // Check cache
  const cacheKey = createCacheKey("intent", query);
  const cached = await cacheGet<IntentClassification>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const prompt = `Classify the intent of this healthcare-related query into ONE of these categories:
- medical_query: Questions about treatments, symptoms, medications, clinical decisions
- document_search: Looking for specific patient notes or documents
- data_analysis: Asking for trends, patterns, statistics across patients
- admin: Administrative tasks (scheduling, billing, etc.)
- unclear: Cannot determine intent

Query: "${query}"

Respond in JSON format: {"intent": "category", "confidence": 0.95, "reasoning": "brief explanation"}`;

    const response = await openai.chat.completions.create({
      model: isUsingOllama ? env.OLLAMA_MODEL : "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 150,
      stream: false,
    } as any);

    const result = JSON.parse(
      response.choices[0].message.content || '{"intent":"unclear","confidence":0.5}'
    );

    const classification: IntentClassification = {
      intent: result.intent || "unclear",
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning,
    };

    // Cache for 24 hours
    await cacheSet(cacheKey, classification, 24 * 3600);

    return classification;
  } catch (error) {
    console.error("[Intent] Classification error:", error);
    return {
      intent: "unclear",
      confidence: 0,
      reasoning: "Error during classification",
    };
  }
}

/**
 * Expand query with medical synonyms and related terms
 */
export async function expandQuery(query: string): Promise<string[]> {
  // Check cache
  const cacheKey = createCacheKey("expand", query);
  const cached = await cacheGet<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const prompt = `Given this medical query, generate 3-5 semantically similar variations using medical synonyms and related terms.

Query: "${query}"

Return ONLY a JSON array of strings: ["variation1", "variation2", ...]`;

    const response = await openai.chat.completions.create({
      model: isUsingOllama ? env.OLLAMA_MODEL : "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
      stream: false,
    } as any);

    const content = response.choices[0].message.content || "[]";
    // Use a RegExp compatible with older JS versions (remove /s flag)
    const match = content.match(/\[([\s\S]*)\]/);
    const expanded = JSON.parse(match ? `[${match[1]}]` : "[]");

    const variations = [query, ...expanded].slice(0, 5);

    await cacheSet(cacheKey, variations, 24 * 3600);

    return variations;
  } catch (error) {
    console.error("[Intent] Query expansion error:", error);
    return [query];
  }
}

