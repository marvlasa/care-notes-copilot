import { env } from "@/config/env";
import { Langfuse } from "langfuse";

export function getLangfuse() {
  if (!env?.LANGFUSE_SECRET_KEY || !env?.LANGFUSE_PUBLIC_KEY) return null;
  return new Langfuse({
    secretKey: env.LANGFUSE_SECRET_KEY!,
    publicKey: env.LANGFUSE_PUBLIC_KEY!,
    baseUrl: env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
  });
}
