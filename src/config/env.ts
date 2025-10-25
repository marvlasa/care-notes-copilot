import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env.local first (takes precedence), then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const EnvSchema = z.object({
  // AI Provider
  USE_OLLAMA: z.coerce.boolean().default(false),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.2'),
  
  // OpenAI (only required if not using Ollama)
  OPENAI_API_KEY: z.string().min(10).optional(),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Langfuse (Optional)
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().default('https://cloud.langfuse.com'),
  
  // Sentry (Optional)
  SENTRY_DSN: z.string().optional(),
  
  // Auth
  JWT_SECRET: z.string().min(32),
  
  // Rate Limiting
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  
  // Cost Management
  COST_ALERT_THRESHOLD_USD: z.coerce.number().default(100),
}).refine((data) => {
  // Require OpenAI API key if not using Ollama
  if (!data.USE_OLLAMA && !data.OPENAI_API_KEY) {
    return false;
  }
  return true;
}, {
  message: "OPENAI_API_KEY is required when USE_OLLAMA is false",
});

export const env = EnvSchema.parse({
  USE_OLLAMA: process.env.USE_OLLAMA,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
  LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
  SENTRY_DSN: process.env.SENTRY_DSN,
  JWT_SECRET: process.env.JWT_SECRET,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  COST_ALERT_THRESHOLD_USD: process.env.COST_ALERT_THRESHOLD_USD,
});

