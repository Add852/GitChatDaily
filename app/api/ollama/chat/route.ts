import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getUserApiSettings,
  callOllamaApi,
  callOpenRouterApi,
  callGeminiApi,
  transformOllamaStream,
  transformOpenRouterStream,
  transformGeminiStream,
} from "@/lib/api-provider";
import { ConversationMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages, systemPrompt } = await req.json();

    // Get user API settings
    const userId = (session.user as any)?.githubId || session.user?.email || "unknown";
    const settings = await getUserApiSettings(
      userId,
      (session.user as any)?.accessToken
    );

    // Build the messages array
    // For initial conversation (empty messages), some models need a user message to respond to
    const requestMessages: ConversationMessage[] = messages.length === 0
      ? [{ role: "user", content: "Start the conversation." }]
      : messages;

    let response: Response;
    let stream: ReadableStream<Uint8Array>;

    if (settings.provider === "openrouter") {
      if (!settings.openRouterApiKey || !settings.openRouterModel) {
        throw new Error("OpenRouter API key or model not configured");
      }

      response = await callOpenRouterApi(
        settings.openRouterApiKey,
        settings.openRouterModel,
        requestMessages,
        systemPrompt,
        true
      );

      stream = transformOpenRouterStream(response.body!);
    } else if (settings.provider === "gemini") {
      if (!settings.geminiApiKey || !settings.geminiModel) {
        throw new Error("Gemini API key or model not configured");
      }

      response = await callGeminiApi(
        settings.geminiApiKey,
        settings.geminiModel,
        requestMessages,
        systemPrompt,
        true
      );

      stream = transformGeminiStream(response.body!);
    } else {
      // Ollama
      const apiUrl = settings.ollamaApiUrl || process.env.OLLAMA_API_URL || "http://localhost:11434";
      const model = settings.ollamaModel || "llama3.2:3b";

      response = await callOllamaApi(
        apiUrl,
        model,
        requestMessages,
        systemPrompt,
        true
      );

      stream = transformOllamaStream(response.body!);
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to get AI response",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

