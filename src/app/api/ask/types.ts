/**
 * Shared types for /api/ask endpoint
 */

export interface AskRequest {
  question: string;
  sessionId?: string;
  model?: string;
  k?: number;
}

export interface AskContext {
  userId: number | null;
  sessionId: string | null;
  question: string;
  model: string;
  k: number;
  ip: string;
  userAgent: string | null;
}

export interface QueryMetrics {
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}
