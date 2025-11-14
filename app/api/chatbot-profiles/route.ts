import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getAllChatbotProfiles,
  getChatbotProfile,
  saveChatbotProfile,
  getCurrentChatbotProfileId,
  setCurrentChatbotProfileId,
  deleteChatbotProfile,
} from "@/lib/storage";
import { ChatbotProfile } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";
import {
  getProfilesFromGitHub,
  getProfileFromGitHub,
  saveProfileToGitHub,
  getCurrentProfileIdFromGitHub,
  saveCurrentProfileIdToGitHub,
} from "@/app/api/github/profile-helpers";

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
        const githubCurrentId = await getCurrentProfileIdFromGitHub(session.user.accessToken);
        if (githubCurrentId) {
          currentProfileId = githubCurrentId;
          setCurrentChatbotProfileId(userId, githubCurrentId);
        }
      } catch (error) {
        console.error("Error fetching current profile from GitHub:", error);
      }
    }

    if (profileId) {
      // Try GitHub first, then fallback to local storage
      if (session.user.accessToken) {
        try {
          const profile = await getProfileFromGitHub(session.user.accessToken, profileId);
          if (profile) {
            return NextResponse.json({
              ...profile,
              isCurrent: profile.id === currentProfileId,
            });
          }
        } catch (e) {
          // Fallback to local storage
        }
      }

      const profile = getChatbotProfile(profileId);
      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      return NextResponse.json({
        ...profile,
        isCurrent: profile.id === currentProfileId,
      });
    }

    // Fetch from GitHub first
    if (session.user.accessToken) {
      try {
        const githubProfiles = await getProfilesFromGitHub(session.user.accessToken);
        if (Array.isArray(githubProfiles) && githubProfiles.length > 0) {
          // Merge with default profile (default always included)
          const mergedProfiles = [
            DEFAULT_CHATBOT_PROFILE,
            ...githubProfiles.filter((p: ChatbotProfile) => p.id !== "default"),
          ];
          if (!mergedProfiles.some((profile) => profile.id === currentProfileId)) {
            currentProfileId = "default";
            setCurrentChatbotProfileId(userId, currentProfileId);
            if (session.user.accessToken) {
              try {
                await saveCurrentProfileIdToGitHub(session.user.accessToken, currentProfileId);
              } catch (error) {
                console.error("Error saving fallback current profile to GitHub:", error);
              }
            }
          }
          return NextResponse.json(
            mergedProfiles.map((profile) => ({
              ...profile,
              isCurrent: profile.id === currentProfileId,
            }))
          );
        }
      } catch (e) {
        console.error("Error fetching from GitHub, using local storage:", e);
      }
    }

    // Fallback to local storage
    const profiles = getAllChatbotProfiles(userId);
    const allProfiles = profiles.find((p) => p.id === "default")
      ? profiles
      : [DEFAULT_CHATBOT_PROFILE, ...profiles];

    if (!allProfiles.some((profile) => profile.id === currentProfileId)) {
      currentProfileId = "default";
      setCurrentChatbotProfileId(userId, currentProfileId);
    }

    return NextResponse.json(
      allProfiles.map((profile) => ({
        ...profile,
        isCurrent: profile.id === currentProfileId,
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

    // Save to local storage
    saveChatbotProfile(session.user.githubId, profile);

    if (profile.isCurrent) {
      setCurrentChatbotProfileId(session.user.githubId, profile.id);
      if (session.user.accessToken) {
        try {
          await saveCurrentProfileIdToGitHub(session.user.accessToken, profile.id);
        } catch (error) {
          console.error("Error saving current profile to GitHub:", error);
        }
      }
    }

    // Save to GitHub (don't save default profile)
    if (profile.id !== "default" && session.user.accessToken) {
      try {
        await saveProfileToGitHub(session.user.accessToken, profile);
      } catch (e) {
        console.error("Error saving to GitHub:", e);
      }
    }

    return NextResponse.json({ success: true, profile });
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
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 });
    }

    // Don't allow deleting the default profile
    if (profileId === "default") {
      return NextResponse.json({ error: "Cannot delete the default profile" }, { status: 400 });
    }

    const userId = session.user.githubId;
    const wasCurrent = getCurrentChatbotProfileId(userId) === profileId;

    // Delete from local storage
    deleteChatbotProfile(userId, profileId);

    if (wasCurrent) {
      setCurrentChatbotProfileId(userId, "default");
      if (session.user.accessToken) {
        try {
          await saveCurrentProfileIdToGitHub(session.user.accessToken, "default");
        } catch (error) {
          console.error("Error resetting current profile on GitHub:", error);
        }
      }
    }

    // Delete from GitHub
    if (session.user.accessToken) {
      try {
        const { deleteProfileFromGitHub } = await import("@/app/api/github/profile-helpers");
        await deleteProfileFromGitHub(session.user.accessToken, profileId);
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

