/**
 * Ollama Adapter - Wraps Ollama to match OpenAI's interface
 * This allows us to use Ollama as a drop-in replacement for OpenAI
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaStreamChunk {
  model: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
}

interface ChatCompletionChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
  }>;
}

export class OllamaAdapter {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = "http://localhost:11434", model: string = "llama3.2") {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  get chat() {
    return {
      completions: {
        create: async (params: {
          model: string;
          messages: ChatCompletionMessageParam[];
          stream: boolean;
          temperature?: number;
          max_tokens?: number;
        }) => {
          if (params.stream) {
            return this.createStream(params.messages, params.model);
          }
          return this.createCompletion(params.messages, params.model);
        },
      },
    };
  }

  private async createCompletion(
    messages: ChatCompletionMessageParam[],
    model?: string
  ): Promise<any> {
    const ollamaMessages: OllamaMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === "string" ? msg.content : "",
    }));

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || this.model,
        messages: ollamaMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      choices: [{ message: { content: data.message.content } }],
    };
  }

  private async *createStream(
    messages: ChatCompletionMessageParam[],
    model?: string
  ): AsyncIterableIterator<ChatCompletionChunk> {
    const ollamaMessages: OllamaMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === "string" ? msg.content : "",
    }));

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || this.model,
        messages: ollamaMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body from Ollama");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data: OllamaStreamChunk = JSON.parse(line);

            if (data.message?.content) {
              yield {
                choices: [
                  {
                    delta: {
                      content: data.message.content,
                    },
                  },
                ],
              };
            }

            if (data.done) {
              return;
            }
          } catch (e) {
            // Skip malformed JSON lines
            console.warn("Failed to parse Ollama chunk:", line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

