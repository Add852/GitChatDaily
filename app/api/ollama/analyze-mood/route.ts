import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getUserApiSettings,
  callOllamaApi,
  callOpenRouterApi,
  callGeminiApi,
} from "@/lib/api-provider";
import { ConversationMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversation } = await req.json();

    const conversationText = conversation
      .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const prompt = `Based on the following conversation, determine the user's mood on a scale of 1-5:
1 = Very Sad 😢
2 = Sad 😕
3 = Neutral 😐
4 = Happy 🙂
5 = Very Happy 😄

Conversation:
${conversationText}

Respond with ONLY a single number (1, 2, 3, 4, or 5) representing the mood. No explanation, just the number.`;

    // Get user API settings
    const userId = (session.user as any)?.githubId || session.user?.email || "unknown";
    const settings = await getUserApiSettings(
      userId,
      (session.user as any)?.accessToken
    );

    const userMessage: ConversationMessage = {
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    let response: Response;
    let moodText: string;

    if (settings.provider === "openrouter") {
      if (!settings.openRouterApiKey || !settings.openRouterModel) {
        throw new Error("OpenRouter API key or model not configured");
      }

      response = await callOpenRouterApi(
        settings.openRouterApiKey,
        settings.openRouterModel,
        [userMessage],
        undefined,
        false
      );

      if (!response.ok) {
        throw new Error("OpenRouter API error");
      }

      const data = await response.json();
      moodText = data?.choices?.[0]?.message?.content?.trim();
    } else if (settings.provider === "gemini") {
      if (!settings.geminiApiKey || !settings.geminiModel) {
        throw new Error("Gemini API key or model not configured");
      }

      response = await callGeminiApi(
        settings.geminiApiKey,
        settings.geminiModel,
        [userMessage],
        undefined,
        false
      );

      if (!response.ok) {
        throw new Error("Gemini API error");
      }

      const data = await response.json();
      moodText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } else {
      // Ollama
      const apiUrl = settings.ollamaApiUrl || process.env.OLLAMA_API_URL || "http://localhost:11434";
      const model = settings.ollamaModel || "llama3.2:3b";

      response = await callOllamaApi(
        apiUrl,
        model,
        [userMessage],
        undefined,
        false
      );

      if (!response.ok) {
        throw new Error("Ollama API error");
      }

      const data = await response.json();
      moodText = data.message.content.trim();
    }

    const mood = parseInt(moodText.match(/\d/)?.[0] || "3", 10);
    const moodValue = Math.max(1, Math.min(5, mood));

    return NextResponse.json({ mood: moodValue });
  } catch (error) {
    console.error("Mood analysis error:", error);
    return NextResponse.json({ mood: 3 }, { status: 200 }); // Default to neutral
  }
}

