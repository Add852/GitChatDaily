import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getAllChatbotProfiles,
  getChatbotProfile,
  saveChatbotProfile,
  getCurrentChatbotProfileId,
  setCurrentChatbotProfileId,
  deleteChatbotProfile,
} from "@/lib/storage";
import { ChatbotProfile } from "@/types";
import { DEFAULT_CHATBOT_PROFILE, clampResponseCount } from "@/lib/constants";
import {
  getChatbotsFromGitHub,
  getChatbotFromGitHub,
  saveChatbotToGitHub,
  getCurrentChatbotIdFromGitHub,
  saveCurrentChatbotIdToGitHub,
} from "@/app/api/github/chatbot-helpers";

const sanitizeProfile = (profile: ChatbotProfile): ChatbotProfile => ({
  ...profile,
  responseCount: clampResponseCount(profile.responseCount),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("id");
    const userId = session.user.githubId;
    let currentProfileId = getCurrentChatbotProfileId(userId);

    if (session.user.accessToken) {
      try {
        const githubCurrentId = await getCurrentChatbotIdFromGitHub(session.user.accessToken);
        if (githubCurrentId) {
          currentProfileId = githubCurrentId;
          setCurrentChatbotProfileId(userId, githubCurrentId);
        }
      } catch (error) {
        console.error("Error fetching current chatbot from GitHub:", error);
      }
    }

    if (profileId) {
      // Try GitHub first, then fallback to local storage
      if (session.user.accessToken) {
        try {
          const chatbot = await getChatbotFromGitHub(session.user.accessToken, profileId);
          if (chatbot) {
            const normalizedProfile = sanitizeProfile(chatbot);
            return NextResponse.json({
              ...normalizedProfile,
              isCurrent: normalizedProfile.id === currentProfileId,
            });
          }
        } catch (e) {
          // Fallback to local storage
        }
      }

      const chatbot = getChatbotProfile(profileId);
      if (!chatbot) {
        return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
      }
      const normalizedProfile = sanitizeProfile(chatbot);
      return NextResponse.json({
        ...normalizedProfile,
        isCurrent: normalizedProfile.id === currentProfileId,
      });
    }

    // Fetch from GitHub first
    if (session.user.accessToken) {
      try {
        const githubChatbots = await getChatbotsFromGitHub(session.user.accessToken);
        if (Array.isArray(githubChatbots) && githubChatbots.length > 0) {
          // Merge with default chatbot (default always included)
          const mergedChatbots = [
            sanitizeProfile(DEFAULT_CHATBOT_PROFILE),
            ...githubChatbots
              .filter((c: ChatbotProfile) => c.id !== "default")
              .map(sanitizeProfile),
          ];
          if (!mergedChatbots.some((chatbot) => chatbot.id === currentProfileId)) {
            currentProfileId = "default";
            setCurrentChatbotProfileId(userId, currentProfileId);
            if (session.user.accessToken) {
              try {
                await saveCurrentChatbotIdToGitHub(session.user.accessToken, currentProfileId);
              } catch (error) {
                console.error("Error saving fallback current chatbot to GitHub:", error);
              }
            }
          }
          return NextResponse.json(
            mergedChatbots.map((chatbot) => ({
              ...chatbot,
              isCurrent: chatbot.id === currentProfileId,
            }))
          );
        }
      } catch (e) {
        console.error("Error fetching from GitHub, using local storage:", e);
      }
    }

    // Fallback to local storage
    const chatbots = getAllChatbotProfiles(userId);
    const allChatbots = chatbots.find((c) => c.id === "default")
      ? chatbots
      : [DEFAULT_CHATBOT_PROFILE, ...chatbots].map(sanitizeProfile);
    const normalizedChatbots = allChatbots.map(sanitizeProfile);

    if (!allChatbots.some((chatbot) => chatbot.id === currentProfileId)) {
      currentProfileId = "default";
      setCurrentChatbotProfileId(userId, currentProfileId);
    }

    return NextResponse.json(
      normalizedChatbots.map((chatbot) => ({
        ...chatbot,
        isCurrent: chatbot.id === currentProfileId,
      }))
    );
  } catch (error) {
    console.error("Chatbot profiles API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chatbot profiles" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile: ChatbotProfile = await req.json();
    const sanitizedProfile = sanitizeProfile(profile);

    // Save to local storage
    saveChatbotProfile(session.user.githubId, sanitizedProfile);

    if (sanitizedProfile.isCurrent) {
      setCurrentChatbotProfileId(session.user.githubId, sanitizedProfile.id);
      if (session.user.accessToken) {
        try {
          await saveCurrentChatbotIdToGitHub(session.user.accessToken, sanitizedProfile.id);
        } catch (error) {
          console.error("Error saving current chatbot to GitHub:", error);
        }
      }
    }

    // Save to GitHub (don't save default chatbot)
    if (sanitizedProfile.id !== "default" && session.user.accessToken) {
      try {
        await saveChatbotToGitHub(session.user.accessToken, sanitizedProfile);
      } catch (e) {
        console.error("Error saving to GitHub:", e);
      }
    }

    return NextResponse.json({ success: true, profile: sanitizedProfile });
  } catch (error) {
    console.error("Chatbot profiles API error:", error);
    return NextResponse.json(
      { error: "Failed to save chatbot profile" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("id");

    if (!profileId) {
      return NextResponse.json({ error: "Chatbot ID is required" }, { status: 400 });
    }

    // Don't allow deleting the default chatbot
    if (profileId === "default") {
      return NextResponse.json({ error: "Cannot delete the default chatbot" }, { status: 400 });
    }

    const userId = session.user.githubId;
    const wasCurrent = getCurrentChatbotProfileId(userId) === profileId;

    // Delete from local storage
    deleteChatbotProfile(userId, profileId);

    if (wasCurrent) {
      setCurrentChatbotProfileId(userId, "default");
      if (session.user.accessToken) {
        try {
          await saveCurrentChatbotIdToGitHub(session.user.accessToken, "default");
        } catch (error) {
          console.error("Error resetting current chatbot on GitHub:", error);
        }
      }
    }

    // Delete from GitHub
    if (session.user.accessToken) {
      try {
        const { deleteChatbotFromGitHub } = await import("@/app/api/github/chatbot-helpers");
        await deleteChatbotFromGitHub(session.user.accessToken, profileId);
      } catch (e) {
        console.error("Error deleting from GitHub:", e);
        // Continue even if GitHub delete fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chatbot profiles API error:", error);
    return NextResponse.json(
      { error: "Failed to delete chatbot profile" },
      { status: 500 }
    );
  }
}

