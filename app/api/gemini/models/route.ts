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

    // Check for API key in query parameter first (for testing before saving)
    const { searchParams } = new URL(req.url);
    const apiKeyFromQuery = searchParams.get("apiKey");

    let geminiApiKey: string | undefined;

    if (apiKeyFromQuery && apiKeyFromQuery.trim() !== "") {
      // Use API key from query parameter if provided
      geminiApiKey = apiKeyFromQuery.trim();
    } else {
      // Get user's Gemini API key from settings
      const userId = (session.user as any)?.githubId || session.user?.email || "unknown";
      const settings = await getUserApiSettings(
        userId,
        (session.user as any)?.accessToken
      );
      geminiApiKey = settings.geminiApiKey;
    }

    if (!geminiApiKey || geminiApiKey.trim() === "") {
      return NextResponse.json(
        { error: "Gemini API key not configured. Please enter your API key in the settings above." },
        { status: 400 }
      );
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(geminiApiKey)}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorText = "";
      try {
        const errorData = await response.json();
        errorText = errorData.error?.message || JSON.stringify(errorData);
      } catch {
        errorText = await response.text();
      }
      throw new Error(`Gemini API error (${response.status}): ${errorText || "Unknown error"}`);
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
