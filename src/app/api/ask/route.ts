import { NextRequest } from "next/server";
import { openai } from "@/ai/openai";
import {
  RequestValidator,
  AuthService,
  RateLimitService,
  AskOrchestrator,
} from "./services";
import { createStreamWithCallbacks } from "./streaming";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<Response> {
  const startTime = Date.now();
  let orchestrator: AskOrchestrator | null = null;

  try {
    // 1. Validate request
    const body = await req.json();
    const validated = RequestValidator.validate(body);

    // 2. Authenticate and build context
    const ctx = await AuthService.createContext(req, validated);

    // 3. Check rate limits
    const rateLimitKey = AuthService.getRateLimitKey(ctx);
    const rateLimit = await RateLimitService.check(rateLimitKey);

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          resetAt: rateLimit.resetAt.toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
            "Retry-After": Math.ceil(
              (rateLimit.resetAt.getTime() - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    // 4. Execute main business logic (intent, retrieval, prompt building)
    orchestrator = new AskOrchestrator(ctx);
    const { messages, queryId, promptTokens, contextsCount } =
      await orchestrator.execute();

    // 5. Stream OpenAI response
    const openAIStream = await openai.chat.completions.create({
      model: ctx.model,
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 1000,
    });

    // 6. Wrap with callbacks for completion, error, finalization
    const stream = createStreamWithCallbacks(openAIStream, {
      onComplete: async (fullAnswer, completionTokens) => {
        await orchestrator!.handleCompletion(
          fullAnswer,
          startTime,
          promptTokens,
          completionTokens,
          contextsCount
        );
      },
      onError: async (error) => {
        await orchestrator!.handleError(error);
      },
      onFinalize: async () => {
        await orchestrator!.finalize();
      },
    });

    // 7. Return streaming response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-Query-Id": queryId.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[Ask] Request error:", error);

    // Cleanup
    if (orchestrator) {
      await orchestrator.handleError(error as Error);
      await orchestrator.finalize();
    }

    const err = error as Error;
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: err.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
