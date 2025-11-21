import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { OpenRouterModel } from "@/types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/models";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(OPENROUTER_API_URL, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const models: OpenRouterModel[] = (data.data || []).map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
      description: model.description,
      context_length: model.context_length,
      pricing: model.pricing,
    }));

    // Filter to only show chat models (exclude embedding, image, etc.)
    const chatModels = models.filter(
      (model) =>
        !model.id.includes("embedding") &&
        !model.id.includes("image") &&
        !model.id.includes("moderation")
    );

    return NextResponse.json(chatModels);
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    return NextResponse.json(
      { error: "Failed to fetch available models" },
      { status: 500 }
    );
  }
}

