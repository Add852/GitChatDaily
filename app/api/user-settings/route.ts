import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserApiSettings } from "@/types";
import {
  getUserApiSettingsFromGitHub,
  saveUserApiSettingsToGitHub,
} from "@/app/api/github/user-settings-helpers";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.githubId;
    let settings: UserApiSettings | null = null;

    // Try GitHub first
    if (session.user.accessToken) {
      try {
        settings = await getUserApiSettingsFromGitHub(session.user.accessToken);
      } catch (error) {
        console.error("Error fetching settings from GitHub:", error);
      }
    }

    // Default settings if none found
    if (!settings) {
      settings = {
        provider: "ollama",
        ollamaApiUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
        ollamaModel: "llama3.2:3b",
      };
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch user settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId || !session?.user?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings: UserApiSettings = await req.json();

    // Validate settings
    if (!settings.provider || !["ollama", "openrouter"].includes(settings.provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be 'ollama' or 'openrouter'" },
        { status: 400 }
      );
    }

    if (settings.provider === "openrouter") {
      if (!settings.openRouterApiKey) {
        return NextResponse.json(
          { error: "OpenRouter API key is required" },
          { status: 400 }
        );
      }
      if (!settings.openRouterModel) {
        return NextResponse.json(
          { error: "OpenRouter model is required" },
          { status: 400 }
        );
      }
    } else {
      // Ollama settings
      settings.ollamaApiUrl = settings.ollamaApiUrl || process.env.OLLAMA_API_URL || "http://localhost:11434";
      settings.ollamaModel = settings.ollamaModel || "llama3.2:3b";
    }

    // Save to GitHub
    await saveUserApiSettingsToGitHub(session.user.accessToken, settings);

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Error saving user settings:", error);
    return NextResponse.json(
      { error: "Failed to save user settings" },
      { status: 500 }
    );
  }
}

