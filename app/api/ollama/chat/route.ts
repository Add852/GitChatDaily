import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages, systemPrompt } = await req.json();

    // Log incoming request
    console.log("\n=== CHAT REQUEST ===");
    console.log("System Prompt:", systemPrompt?.substring(0, 100) + "...");
    console.log("Messages count:", messages.length);
    if (messages.length > 0) {
      console.log("Last message:", messages[messages.length - 1]);
    }

    // Build the messages array for Ollama
    // For initial conversation (empty messages), some models need a user message to respond to
    // We'll add a minimal trigger that the system prompt will override
    const requestMessages = messages.length === 0
      ? [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Start the conversation." }
        ]
      : [
          { role: "system", content: systemPrompt },
          ...messages,
        ];

    console.log("Request messages structure:", JSON.stringify(requestMessages.map(m => ({ role: m.role, contentLength: m.content?.length }))));

    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages: requestMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ollama API error response:", errorText);
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }
    
    console.log("Ollama response status:", response.status);

    // Create a ReadableStream to forward the Ollama stream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        let buffer = "";
        let fullResponse = "";
        let hasContent = false;
        let chunkCount = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("Stream reader done. Total chunks processed:", chunkCount);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (!line.trim()) continue;
              chunkCount++;
              try {
                const data = JSON.parse(line);
                // Log first few chunks to see structure
                if (chunkCount <= 3) {
                  console.log(`Chunk ${chunkCount} - Raw Ollama data:`, JSON.stringify(data).substring(0, 300));
                }
                
                if (data.message?.content !== undefined) {
                  hasContent = true;
                  fullResponse += data.message.content;
                  if (chunkCount <= 3) {
                    console.log("Content chunk received:", data.message.content.substring(0, 100));
                  }
                  // Send the incremental content chunk to the client
                  // Forward the done flag from Ollama
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ content: data.message.content, done: data.done || false })}\n\n`)
                  );
                } else if (data.content !== undefined) {
                  // Some Ollama responses might have content directly
                  hasContent = true;
                  fullResponse += data.content;
                  if (chunkCount <= 3) {
                    console.log("Content chunk received (direct):", data.content.substring(0, 100));
                  }
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ content: data.content, done: data.done || false })}\n\n`)
                  );
                } else if (data.done) {
                  console.log("Received done signal from Ollama");
                }
              } catch (e) {
                console.error("Error parsing Ollama line:", e, "Line:", line.substring(0, 100));
              }
            }
          }
          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (data.message?.content !== undefined) {
                hasContent = true;
                fullResponse += data.message.content;
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify({ content: data.message.content, done: true })}\n\n`)
                );
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
          
          // Log the complete response
          console.log("\n=== ASSISTANT RESPONSE ===");
          console.log("Full response:", fullResponse);
          console.log("Response length:", fullResponse.length);
          console.log("Has content:", hasContent);
          console.log("Total chunks processed:", chunkCount);
          if (!hasContent && chunkCount > 0) {
            console.warn("WARNING: Received chunks but no content was extracted!");
          }
          if (!hasContent && chunkCount === 0) {
            console.warn("WARNING: No chunks received from Ollama!");
          }
          console.log("==========================\n");
          
          // Send final done signal only if we haven't already sent one with content
          if (hasContent) {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`)
            );
          } else {
            console.error("ERROR: No content to send to client!");
          }
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Ollama API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get AI response" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

