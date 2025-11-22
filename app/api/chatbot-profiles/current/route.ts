import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getAllChatbotProfiles,
  setCurrentChatbotProfileId,
} from "@/lib/storage";
import {
  getChatbotsFromGitHub,
  saveCurrentChatbotIdToGitHub,
} from "@/app/api/github/chatbot-helpers";
import { ChatbotProfile } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profileId } = await req.json();
    if (!profileId) {
      return NextResponse.json({ error: "Chatbot ID is required" }, { status: 400 });
    }

    const userId = session.user.githubId;
    let chatbots: ChatbotProfile[] = [];

    if (session.user.accessToken) {
      try {
        chatbots = await getChatbotsFromGitHub(session.user.accessToken);
      } catch (error) {
        console.error("Error fetching chatbots from GitHub while setting current:", error);
      }
    }

    if (chatbots.length === 0) {
      chatbots = getAllChatbotProfiles(userId);
    }

    const chatbotExists =
      profileId === "default" ||
      chatbots.some((chatbot) => chatbot.id === profileId);

    if (!chatbotExists) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    setCurrentChatbotProfileId(userId, profileId);

    if (session.user.accessToken) {
      try {
        await saveCurrentChatbotIdToGitHub(session.user.accessToken, profileId);
      } catch (error) {
        console.error("Error saving current chatbot to GitHub:", error);
      }
    }

    return NextResponse.json({ success: true, profileId });
  } catch (error) {
    console.error("Error setting current chatbot profile:", error);
    return NextResponse.json(
      { error: "Failed to set current chatbot profile" },
      { status: 500 }
    );
  }
}

