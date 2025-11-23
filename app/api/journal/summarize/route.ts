import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { HighlightItem, ConversationMessage } from "@/types";
import {
  getUserApiSettings,
  callOllamaApi,
  callOpenRouterApi,
  callGeminiApi,
} from "@/lib/api-provider";

const MIN_HIGHLIGHTS = 1;
const MAX_HIGHLIGHTS = 5;

interface SummaryResponse {
  highlights: HighlightItem[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a journaling assistant that extracts daily highlights and writes a concise narrative summary focused on capturing what actually happened during the day.

Return ONLY valid JSON that matches this TypeScript type:
{
  "highlights": Array<{ "title": string; "description": string }>,
  "summary": string
}

CRITICAL PRIORITY: Focus on CONCRETE EVENTS, ACTIVITIES, and FACTUAL DETAILS that help the user remember and recall their day. The purpose of journaling is to preserve memories of what happened, not just how the user felt.

Rules:
- Provide 1-5 highlights (prioritize the most significant events and activities that happened today)
- Every highlight must come strictly from USER lines in the transcript. Only use the information that appears in ASSISTANT lines as a reference to the user's response. DO NOT INVENT DETAILS THAT ARE NOT COMING FROM THE USER'S MOUTH OR THOUGHTS EVEN IF IT MEANS THERE IS NO MEANINGFUL SUMMARY OR HIGHLIGHT CAN BE GENERATED FROM IT.
- Titles must be short (max 5 words) and Title Case, describing the event/activity (e.g., "Team Meeting", "Project Completion", "Coffee With Sarah").
- Descriptions are 1-2 sentence/s, first person ("I"), and should capture:
  * WHAT happened (specific events, activities, accomplishments)
  * WHO was involved (people met, worked with, talked to)
  * WHERE things happened (places visited, locations)
  * WHAT was accomplished (tasks completed, goals achieved, progress made)
  * Include emotions/feelings ONLY as secondary context, not as the primary focus
- Prioritize factual, recallable details over abstract feelings. For example, prefer "I completed the quarterly report and presented it to the team" over "I felt productive today."
- If the assistant suggested something the user didn't confirm, leave it out.
- Summary is 2-4 sentences, first person ("I"), and should:
  * Lead with concrete events and activities that happened
  * Describe the sequence of significant events throughout the day
  * Include specific details that help recall (who, what, where, when)
  * Mention emotions/feelings only as context, not as the main focus
  * Help the user remember what actually happened, not just how they felt
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

    // Get user API settings
    const userId = (session.user as any)?.githubId || session.user?.email || "unknown";
    const settings = await getUserApiSettings(
      userId,
      (session.user as any)?.accessToken
    );

    const userMessage: ConversationMessage = {
      role: "user",
      content: `Conversation Transcript:\n${conversationText}`,
      timestamp: new Date().toISOString(),
    };

    let response: Response;
    let rawContent: string;

    if (settings.provider === "openrouter") {
      if (!settings.openRouterApiKey || !settings.openRouterModel) {
        throw new Error("OpenRouter API key or model not configured");
      }

      response = await callOpenRouterApi(
        settings.openRouterApiKey,
        settings.openRouterModel,
        [userMessage],
        SYSTEM_PROMPT,
        false
      );

      if (!response.ok) {
        throw new Error("OpenRouter API error");
      }

      const data = await response.json();
      rawContent = data?.choices?.[0]?.message?.content?.trim();
      if (!rawContent) {
        throw new Error("Empty response from model");
      }
    } else if (settings.provider === "gemini") {
      if (!settings.geminiApiKey || !settings.geminiModel) {
        throw new Error("Gemini API key or model not configured");
      }

      response = await callGeminiApi(
        settings.geminiApiKey,
        settings.geminiModel,
        [userMessage],
        SYSTEM_PROMPT,
        false
      );

      if (!response.ok) {
        throw new Error("Gemini API error");
      }

      const data = await response.json();
      rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (!rawContent) {
        throw new Error("Empty response from model");
      }
    } else {
      // Ollama
      const apiUrl = settings.ollamaApiUrl || process.env.OLLAMA_API_URL || "http://localhost:11434";
      const model = settings.ollamaModel || "llama3.2:3b";

      response = await callOllamaApi(
        apiUrl,
        model,
        [userMessage],
        SYSTEM_PROMPT,
        false
      );

      if (!response.ok) {
        throw new Error("Ollama API error");
      }

      const data = await response.json();
      rawContent = data?.message?.content?.trim();
      if (!rawContent) {
        throw new Error("Empty response from model");
      }
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

