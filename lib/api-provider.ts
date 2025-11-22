import { UserApiSettings, ConversationMessage } from "@/types";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

export async function getUserApiSettings(userId: string, accessToken?: string): Promise<UserApiSettings> {
  if (accessToken) {
    try {
      const { getUserApiSettingsFromGitHub } = await import("@/app/api/github/user-settings-helpers");
      const settings = await getUserApiSettingsFromGitHub(accessToken);
      if (settings) {
        return settings;
      }
    } catch (error) {
      console.error("Error fetching settings from GitHub:", error);
    }
  }

  // Default settings
  return {
    provider: "ollama",
    ollamaApiUrl: OLLAMA_API_URL,
    ollamaModel: "llama3.2:3b",
  };
}

export async function callOllamaApi(
  apiUrl: string,
  model: string,
  messages: ConversationMessage[],
  systemPrompt?: string,
  stream: boolean = true
): Promise<Response> {
  // Ollama supports "system", "user", and "assistant" roles
  type OllamaMessage = {
    role: "system" | "user" | "assistant";
    content: string;
  };

  const requestMessages: OllamaMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))]
    : messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

  const response = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: requestMessages,
      stream,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${response.status} ${errorText}`);
  }

  return response;
}

export async function callOpenRouterApi(
  apiKey: string,
  model: string,
  messages: ConversationMessage[],
  systemPrompt?: string,
  stream: boolean = true
): Promise<Response> {
  // Convert messages format for OpenRouter
  // OpenRouter supports "system", "user", and "assistant" roles
  type OpenRouterMessage = {
    role: "system" | "user" | "assistant";
    content: string;
  };

  const openRouterMessages: OpenRouterMessage[] = messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Add system prompt if provided
  if (systemPrompt) {
    openRouterMessages.unshift({
      role: "system",
      content: systemPrompt,
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "GitChat Journal",
    },
    body: JSON.stringify({
      model,
      messages: openRouterMessages,
      stream,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  return response;
}

export function transformOpenRouterStream(ollamaStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const reader = ollamaStream.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            
            // Handle [DONE] message
            if (line.trim() === "data: [DONE]") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
              );
              continue;
            }

            if (!line.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(line.slice(6));
              
              // OpenRouter SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
              if (data.choices && data.choices[0]) {
                const delta = data.choices[0].delta;
                const content = delta?.content;
                const finishReason = data.choices[0].finish_reason;

                if (content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content, done: false })}\n\n`)
                  );
                }

                if (finishReason) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
                  );
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.choices && data.choices[0]) {
              const delta = data.choices[0].delta;
              const content = delta?.content;
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content, done: true })}\n\n`)
                );
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function callGeminiApi(
  apiKey: string,
  model: string,
  messages: ConversationMessage[],
  systemPrompt?: string,
  stream: boolean = true
): Promise<Response> {
  // Gemini API uses a different format
  // Convert messages to Gemini's format
  // Gemini uses "user" and "model" roles (not "assistant")
  type GeminiContent = {
    role: "user" | "model";
    parts: Array<{ text: string }>;
  };

  const geminiContents: GeminiContent[] = [];
  
  // Add system prompt as first user message if provided
  if (systemPrompt) {
    geminiContents.push({
      role: "user",
      parts: [{ text: systemPrompt }],
    });
    // Add a model response to acknowledge the system prompt
    geminiContents.push({
      role: "model",
      parts: [{ text: "Understood." }],
    });
  }

  // Convert conversation messages
  for (const msg of messages) {
    if (msg.role === "user") {
      geminiContents.push({
        role: "user",
        parts: [{ text: msg.content }],
      });
    } else if (msg.role === "assistant") {
      geminiContents.push({
        role: "model",
        parts: [{ text: msg.content }],
      });
    }
  }

  // Use the Gemini REST API
  // For streaming, use SSE endpoint; for non-streaming, use regular endpoint
  const endpoint = stream ? "streamGenerateContent" : "generateContent";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${apiKey}${stream ? "&alt=sse" : ""}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: geminiContents,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  return response;
}

export function transformGeminiStream(geminiStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const reader = geminiStream.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            
            // Gemini SSE format: "data: {json}" or plain JSONL
            let jsonLine = line;
            if (line.startsWith("data: ")) {
              jsonLine = line.slice(6); // Remove "data: " prefix
            }
            
            try {
              const data = JSON.parse(jsonLine);
              
              // Gemini streaming format: { "candidates": [{ "content": { "parts": [{ "text": "..." }] } }] }
              if (data.candidates && data.candidates[0]) {
                const candidate = data.candidates[0];
                const content = candidate.content;
                if (content && content.parts && content.parts[0]) {
                  const text = content.parts[0].text;
                  if (text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content: text, done: false })}\n\n`)
                    );
                  }
                }
                
                // Check if this is the final chunk
                if (candidate.finishReason) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
                  );
                }
              }
            } catch (e) {
              // Skip invalid JSON - might be empty lines or other SSE formatting
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            let jsonLine = buffer.trim();
            if (jsonLine.startsWith("data: ")) {
              jsonLine = jsonLine.slice(6);
            }
            const data = JSON.parse(jsonLine);
            if (data.candidates && data.candidates[0]) {
              const candidate = data.candidates[0];
              const content = candidate.content;
              if (content && content.parts && content.parts[0]) {
                const text = content.parts[0].text;
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: text, done: true })}\n\n`)
                  );
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function transformOllamaStream(ollamaStream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const reader = ollamaStream.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      let buffer = "";
      let fullResponse = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const data = JSON.parse(line);
              
              if (data.message?.content !== undefined) {
                fullResponse += data.message.content;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: data.message.content, done: data.done || false })}\n\n`)
                );
              } else if (data.content !== undefined) {
                fullResponse += data.content;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: data.content, done: data.done || false })}\n\n`)
                );
              } else if (data.done) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
                );
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.message?.content !== undefined) {
              fullResponse += data.message.content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: data.message.content, done: true })}\n\n`)
              );
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        if (fullResponse) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

