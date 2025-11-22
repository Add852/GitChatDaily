import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { GeminiModel } from "@/types";
import { getUserApiSettings } from "@/lib/api-provider";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's Gemini API key from settings
    const userId = (session.user as any)?.githubId || session.user?.email || "unknown";
    const settings = await getUserApiSettings(
      userId,
      (session.user as any)?.accessToken
    );

    if (!settings.geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 400 }
      );
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${settings.geminiApiKey}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const models: GeminiModel[] = (data.models || [])
      .filter((model: any) => {
        // Filter to only show models that support generateContent
        return (
          model.supportedGenerationMethods?.includes("generateContent") ||
          model.supportedGenerationMethods?.includes("streamGenerateContent")
        );
      })
      .map((model: any) => ({
        id: model.name?.replace("models/", "") || model.name,
        name: model.displayName || model.name?.replace("models/", "") || model.name,
        description: model.description,
        displayName: model.displayName,
        supportedGenerationMethods: model.supportedGenerationMethods,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
      }));

    // Sort by name
    models.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(models);
  } catch (error: any) {
    console.error("Error fetching Gemini models:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch available models" },
      { status: 500 }
    );
  }
}
