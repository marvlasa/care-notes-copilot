import OpenAI from "openai";
import { env } from "@/config/env";
import { OllamaAdapter } from "./ollama-adapter";

/**
 * AI Client - Supports both OpenAI and Ollama
 * 
 * Set USE_OLLAMA=true in .env to use free local AI with Ollama
 * Otherwise, it will use OpenAI (requires API key)
 */
export const openai = env.USE_OLLAMA
  ? new OllamaAdapter(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL)
  : new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const isUsingOllama = env.USE_OLLAMA;
