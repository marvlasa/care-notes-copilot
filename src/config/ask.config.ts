export const ASK_CONFIG = {
  MODEL_NAME: "gpt-4o-mini",
  TOP_K_RESULTS: 4,
  SYSTEM_PROMPT:
    "You are a medical documentation assistant. Use only the provided context from clinical notes. If unknown, say you don't know. Be concise and safe.",
} as const;

