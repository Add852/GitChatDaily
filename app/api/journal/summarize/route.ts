import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { HighlightItem } from "@/types";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

interface SummaryResponse {
  highlights: HighlightItem[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a journaling assistant that extracts daily highlights and writes a concise narrative summary.

Return ONLY valid JSON that matches this TypeScript type:
{
  "highlights": Array<{ "title": string; "description": string }>,
  "summary": string
}

Rules:
- Provide 2-4 highlights.
- Titles must be short (max 5 words) and Title Case.
- Descriptions are 1 sentence, first person ("I"), and include concrete details from the conversation.
- Summary is 2-3 sentences, warm, second person, and mentions emotions plus outcomes.
- Do not include markdown or additional prose outside the JSON payload.`;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversation } = await req.json();
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return NextResponse.json(
        { error: "Conversation data missing" },
        { status: 400 }
      );
    }

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
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Conversation Transcript:\n${conversationText}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Ollama API error");
    }

    const data = await response.json();
    const rawContent = data?.message?.content?.trim();
    if (!rawContent) {
      throw new Error("Empty response from model");
    }

    const parsedPayload = parseJsonPayload(rawContent);
    if (!parsedPayload) {
      throw new Error("Invalid summary format");
    }

    const summaryResponse: SummaryResponse = {
      highlights: normalizeHighlights(parsedPayload.highlights),
      summary: typeof parsedPayload.summary === "string"
        ? parsedPayload.summary.trim()
        : "",
    };

    return NextResponse.json(summaryResponse);
  } catch (error) {
    console.error("Summarization error:", error);
    return NextResponse.json(
      { error: "Failed to generate highlights and summary" },
      { status: 500 }
    );
  }
}

function parseJsonPayload(content: string): any | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const jsonText = content.slice(start, end + 1);
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Failed to parse JSON payload:", error);
    return null;
  }
}

function normalizeHighlights(input: any): HighlightItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item, index) => {
      const title =
        typeof item?.title === "string" && item.title.trim().length > 0
          ? item.title.trim()
          : `Highlight ${index + 1}`;
      const description =
        typeof item?.description === "string" && item.description.trim().length > 0
          ? item.description.trim()
          : "";

      if (!description) {
        return null;
      }

      return { title, description };
    })
    .filter((item): item is HighlightItem => Boolean(item));
}

