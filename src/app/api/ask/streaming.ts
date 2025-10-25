/**
 * Streaming response handler
 * Encapsulates streaming logic with proper error handling
 */

import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

interface StreamCallbacks {
  onComplete: (fullAnswer: string, completionTokens: number) => Promise<void>;
  onError: (error: Error) => Promise<void>;
  onFinalize: () => Promise<void>;
}

/**
 * Creates an enhanced ReadableStream that wraps OpenAI streaming response
 * with lifecycle callbacks for completion, error handling, and cleanup
 */
export function createStreamWithCallbacks(
  openAIStream: Stream<ChatCompletionChunk>,
  callbacks: StreamCallbacks
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let fullAnswer = "";
      let completionTokens = 0;

      try {
        // Stream tokens from OpenAI
        for await (const chunk of openAIStream) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            fullAnswer += delta;
            completionTokens += 1; // Rough estimate
            controller.enqueue(encoder.encode(delta));
          }
        }

        // Success: call completion callback
        await callbacks.onComplete(fullAnswer, completionTokens);

      } catch (error) {
        console.error("[Streaming] Error:", error);
        
        // Error: call error callback
        await callbacks.onError(error as Error);
        
        controller.error(error);
        return;

      } finally {
        // Always: finalize and close
        await callbacks.onFinalize();
        controller.close();
      }
    },
  });
}

