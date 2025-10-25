import { pool } from "@/db";
import OpenAI from "openai";
import { openai, isUsingOllama } from "@/ai/openai";
import { cacheGet, cacheSet, createCacheKey } from "@/lib/redis";
import crypto from "crypto";

export interface RetrievalResult {
  content: string;
  similarity: number;
  documentId?: number;
  chunkId?: number;
}

/**
 * Embed query with caching
 */
export async function embedQuery(text: string): Promise<number[]> {
  // Check cache first
  const cacheKey = createCacheKey("embed", text);
  const cached = await cacheGet<number[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Generate embedding
  let embedding: number[];
  
  if (isUsingOllama) {
    const response = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    const data = await response.json();
    embedding = data.embedding;
  } else {
    const { data } = await (openai as OpenAI).embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    embedding = data[0].embedding;
  }

  // Cache for 7 days
  await cacheSet(cacheKey, embedding, 7 * 24 * 3600);

  // Also store in DB for analysis
  const textHash = crypto.createHash("sha256").update(text).digest("hex");
  pool
    .query(
      `
    INSERT INTO embedding_cache (text_hash, embedding, model)
    VALUES ($1, $2, $3)
    ON CONFLICT (text_hash) 
    DO UPDATE SET accessed_at = NOW(), access_count = embedding_cache.access_count + 1
    `,
      [textHash, JSON.stringify(embedding), "text-embedding-3-small"]
    )
    .catch((err) => console.error("[Embed] Cache DB error:", err));

  return embedding;
}

/**
 * Vector similarity search
 */
async function vectorSearch(
  embedding: number[],
  k: number
): Promise<RetrievalResult[]> {
  const { rows } = await pool.query(
    `
    SELECT 
      c.id as chunk_id,
      c.document_id,
      c.content,
      1 - (c.embedding <=> $1::vector) AS similarity
    FROM chunks c
    ORDER BY c.embedding <=> $1::vector
    LIMIT $2
    `,
    [JSON.stringify(embedding), k * 2] // Fetch 2x for reranking
  );

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    content: r.content,
    similarity: parseFloat(r.similarity),
  }));
}

/**
 * Keyword search using PostgreSQL full-text search
 */
async function keywordSearch(
  query: string,
  k: number
): Promise<RetrievalResult[]> {
  const { rows } = await pool.query(
    `
    SELECT 
      c.id as chunk_id,
      c.document_id,
      c.content,
      similarity(c.content, $1) AS similarity
    FROM chunks c
    WHERE c.content % $1  -- % is the similarity operator
    ORDER BY similarity(c.content, $1) DESC
    LIMIT $2
    `,
    [query, k]
  );

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    content: r.content,
    similarity: parseFloat(r.similarity),
  }));
}

/**
 * Hybrid search: combine vector and keyword results
 */
async function hybridSearch(
  query: string,
  embedding: number[],
  k: number
): Promise<RetrievalResult[]> {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(embedding, k),
    keywordSearch(query, k),
  ]);

  // Merge and deduplicate by chunk_id
  const resultsMap = new Map<number, RetrievalResult>();

  // Add vector results with weight
  for (const result of vectorResults) {
    if (result.chunkId) {
      resultsMap.set(result.chunkId, {
        ...result,
        similarity: result.similarity * 0.7, // 70% weight to vector
      });
    }
  }

  // Add keyword results with weight
  for (const result of keywordResults) {
    if (result.chunkId) {
      const existing = resultsMap.get(result.chunkId);
      if (existing) {
        // Combine scores
        existing.similarity += result.similarity * 0.3; // 30% weight to keyword
      } else {
        resultsMap.set(result.chunkId, {
          ...result,
          similarity: result.similarity * 0.3,
        });
      }
    }
  }

  // Sort by combined score
  return Array.from(resultsMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/**
 * Simple cross-encoder reranking using LLM
 */
async function rerank(
  query: string,
  results: RetrievalResult[],
  topK: number
): Promise<RetrievalResult[]> {
  // For production, use a dedicated reranking model (Cohere, Jina, etc.)
  // Here we use a simple LLM-based approach for demonstration

  if (results.length <= topK) {
    return results;
  }

  try {
    const prompt = `Given the question and candidate passages, score each passage's relevance from 0-10.
Question: ${query}

Passages:
${results.map((r, i) => `${i + 1}. ${r.content.substring(0, 200)}`).join("\n\n")}

Return ONLY a JSON array of scores: [score1, score2, ...]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 200,
      stream: false,
    } as any);

    const scoresText = response.choices[0].message.content || "[]";
    const scores = JSON.parse(scoresText.match(/\[[\d,\s]+\]/)?.[0] || "[]");

    // Combine with original similarity
    results.forEach((r, i) => {
      if (scores[i] !== undefined) {
        r.similarity = (r.similarity + scores[i] / 10) / 2;
      }
    });

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  } catch (error) {
    console.error("[Rerank] Error:", error);
    return results.slice(0, topK);
  }
}

/**
 * Main retrieval function with caching, hybrid search, and reranking
 */
export async function retrieveTopK(
  query: string,
  k: number = 4,
  options: {
    useHybrid?: boolean;
    useRerank?: boolean;
    useCache?: boolean;
  } = {}
): Promise<RetrievalResult[]> {
  const {
    useHybrid = true,
    useRerank = true,
    useCache = true,
  } = options;

  // Check cache
  if (useCache) {
    const cacheKey = createCacheKey("retrieve", `${query}:${k}:${useHybrid}`);
    const cached = await cacheGet<RetrievalResult[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Get embedding
  const embedding = await embedQuery(query);

  // Retrieve results
  let results: RetrievalResult[];
  if (useHybrid) {
    results = await hybridSearch(query, embedding, k * 2);
  } else {
    results = await vectorSearch(embedding, k * 2);
  }

  // Rerank
  if (useRerank && results.length > k) {
    results = await rerank(query, results, k);
  } else {
    results = results.slice(0, k);
  }

  // Cache results for 1 hour
  if (useCache) {
    const cacheKey = createCacheKey("retrieve", `${query}:${k}:${useHybrid}`);
    await cacheSet(cacheKey, results, 3600);
  }

  return results;
}
