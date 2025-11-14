import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversation } = await req.json();

    const conversationText = conversation
      .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    const prompt = `Based on the following conversation, create a warm, supportive summary of the user's day in markdown format. The summary should be:
- Written in second person ("you")
- Warm and empathetic
- Well-structured with markdown formatting
- 2-4 paragraphs long
- Focus on the key events, feelings, and insights from the conversation

Conversation:
${conversationText}

Provide only the markdown summary, no additional text.`;

    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Ollama API error");
    }

    // Stream the summary response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        let buffer = "";
        let fullSummary = "";
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
                  fullSummary += data.message.content;
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ content: data.message.content, done: data.done || false })}\n\n`)
                  );
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
          
          // Send final done signal
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
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
    console.error("Summarization error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}

