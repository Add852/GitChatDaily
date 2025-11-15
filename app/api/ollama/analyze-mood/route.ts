import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

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

    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error("Ollama API error");
    }

    const data = await response.json();
    const moodText = data.message.content.trim();
    const mood = parseInt(moodText.match(/\d/)?.[0] || "3", 10);
    const moodValue = Math.max(1, Math.min(5, mood));

    return NextResponse.json({ mood: moodValue });
  } catch (error) {
    console.error("Mood analysis error:", error);
    return NextResponse.json({ mood: 3 }, { status: 200 }); // Default to neutral
  }
}

