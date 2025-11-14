import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

const buildPrompt = (conversationText: string) => `You are an expert journaling assistant. Produce ONLY the following markdown sections while streaming your response (do NOT include any JSON, logging data, or extra commentary):

### Highlights
- concise bullet tied to the transcript
- another bullet
(Provide 2-4 bullets total. Each must mention something the user actually said.)

### Summary
Write 1-2 warm paragraphs in second person ("you") describing how the user felt, their challenges, gratitude, and insights.

Rules:
- Do not invent events. If information is missing, acknowledge it gently but still provide supportive text.
- Do NOT output JSON, logging messages, or any sections besides the two above.

Chat transcript:
${conversationText}`;

const DEFAULT_HIGHLIGHTS = ["You took time to reflect on your day."];
const DEFAULT_SUMMARY =
  "You reflected on your day, acknowledging both your challenges and your wins.";

const stripListMarker = (line: string) => line.replace(/^[\-\*\u2022\d\.\s]+/, "").trim();

const parseHighlights = (markdown: string) => {
  const sectionRegex = /###\s+Highlights\s*\n([\s\S]*?)(?=\n###\s+|$)/i;
  const sectionMatch = sectionRegex.exec(markdown);
  const sectionBody = sectionMatch?.[1] ?? "";

  const bullets = sectionBody
    .split(/\r?\n/)
    .map(stripListMarker)
    .filter(Boolean);

  if (bullets.length > 0) return bullets.slice(0, 4);

  const fallback = (markdown.match(/^[\-\*\u2022].+/gim) || [])
    .map(stripListMarker)
    .filter(Boolean);

  return fallback.length > 0 ? fallback.slice(0, 4) : DEFAULT_HIGHLIGHTS;
};

const parseSummary = (markdown: string) => {
  const summaryRegex = /###\s+Summary\s*\n([\s\S]*)/i;
  const match = summaryRegex.exec(markdown);
  const summary = match?.[1]?.trim() || markdown.trim();
  return summary.length ? summary : DEFAULT_SUMMARY;
};

const parseSections = (markdown: string) => {
  const raw = markdown?.trim() || "";
  if (!raw) {
    return {
      highlights: DEFAULT_HIGHLIGHTS,
      summary: DEFAULT_SUMMARY,
      raw: "",
    };
  }

  return {
    highlights: parseHighlights(raw),
    summary: parseSummary(raw),
    raw,
  };
};

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

    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages: [{ role: "user", content: buildPrompt(conversationText) }],
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error("Ollama API error");
    }

    const encoder = new TextEncoder();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let markdown = "";

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundary = buffer.lastIndexOf("\n\n");
            if (boundary === -1) {
              boundary = buffer.lastIndexOf("\n");
            }
            if (boundary !== -1) {
              const chunk = buffer.slice(0, boundary + 1);
              buffer = buffer.slice(boundary + 1);

              if (chunk.trim()) {
                markdown += chunk;
                sendEvent({ preview: markdown });
              }
            }
          }
          markdown = (markdown + buffer).trim();
          const sections = parseSections(markdown);
          sendEvent({ done: true, payload: sections });
        } catch (error) {
          console.error("Summarization stream error:", error);
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

