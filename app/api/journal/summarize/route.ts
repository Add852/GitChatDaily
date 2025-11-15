import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { HighlightItem, ConversationMessage } from "@/types";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
const MIN_HIGHLIGHTS = 1;
const MAX_HIGHLIGHTS = 5;

interface SummaryResponse {
  highlights: HighlightItem[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a journaling assistant that extracts daily highlights and writes a concise narrative summary in the user's own voice.

Return ONLY valid JSON that matches this TypeScript type:
{
  "highlights": Array<{ "title": string; "description": string }>,
  "summary": string
}

Rules:
- Provide 1-5 highlights (depending on how much is necessary to cover everything that happened today)
- Every highlight must come strictly from USER lines in the transcript. Only use the information that appears in ASSISTANT lines as a reference to the user's response.
- Titles must be short (max 5 words) and Title Case.
- Descriptions are 1 sentence, first person ("I"), and quote/paraphrase only what the user explicitly stated.
- If the assistant suggested something the user didn't confirm, leave it out.
- Summary is 1-3 sentences, first person ("I"), and should reference just the user's own words or feelings without inventing new details.
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

    const conversationMessages = conversation as ConversationMessage[];

    const conversationText = conversationMessages
      .map((msg) => {
        const speaker = msg.role === "user" ? "USER" : "ASSISTANT";
        return `${speaker}: ${msg.content}`;
      })
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

    const normalizedHighlights = normalizeHighlights(parsedPayload.highlights);
    const boundedHighlights = enforceHighlightBounds(normalizedHighlights, conversationMessages);

    const summaryResponse: SummaryResponse = {
      highlights: boundedHighlights,
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
    .filter((item): item is HighlightItem => Boolean(item))
    .slice(0, MAX_HIGHLIGHTS);
}

function enforceHighlightBounds(
  highlights: HighlightItem[],
  conversation: ConversationMessage[]
): HighlightItem[] {
  const limited = highlights.slice(0, MAX_HIGHLIGHTS);
  if (limited.length >= MIN_HIGHLIGHTS) {
    return limited;
  }

  const userMessages = Array.isArray(conversation)
    ? conversation
        .filter((msg) => msg?.role === "user" && typeof msg.content === "string")
        .map((msg) => msg.content.trim())
        .filter(Boolean)
    : [];

  const usedDescriptions = new Set(limited.map((item) => item.description));
  let fallbackIndex = 0;

  while (limited.length < MIN_HIGHLIGHTS && fallbackIndex < userMessages.length) {
    const content = userMessages[fallbackIndex++];
    if (usedDescriptions.has(content)) continue;

    const description = content.length > 240 ? `${content.slice(0, 237)}...` : content;
    limited.push({
      title: `Reflection ${limited.length + 1}`,
      description,
    });
    usedDescriptions.add(content);
  }

  return limited.slice(0, MAX_HIGHLIGHTS);
}

