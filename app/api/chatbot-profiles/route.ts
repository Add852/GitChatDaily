import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getAllChatbotProfiles,
  getChatbotProfile,
  saveChatbotProfile,
  getCurrentChatbotProfileId,
  setCurrentChatbotProfileId,
} from "@/lib/storage";
import { ChatbotProfile } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";
import { getProfilesFromGitHub, getProfileFromGitHub, saveProfileToGitHub } from "@/app/api/github/profile-helpers";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("id");

    if (profileId) {
      // Try GitHub first, then fallback to local storage
      if (session.user.accessToken) {
        try {
          const profile = await getProfileFromGitHub(session.user.accessToken, profileId);
          if (profile) return NextResponse.json(profile);
        } catch (e) {
          // Fallback to local storage
        }
      }

      const profile = getChatbotProfile(profileId);
      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      return NextResponse.json(profile);
    }

    // Fetch from GitHub first
    if (session.user.accessToken) {
      try {
        const githubProfiles = await getProfilesFromGitHub(session.user.accessToken);
        if (Array.isArray(githubProfiles) && githubProfiles.length > 0) {
          // Merge with default profile (default always included, but not forced as selected)
          const allProfiles = [DEFAULT_CHATBOT_PROFILE, ...githubProfiles.filter((p: ChatbotProfile) => p.id !== "default")];
          const currentProfileId = getCurrentChatbotProfileId(session.user.githubId);
          return NextResponse.json({ profiles: allProfiles, currentProfileId });
        }
      } catch (e) {
        console.error("Error fetching from GitHub, using local storage:", e);
      }
    }

    // Fallback to local storage
    const profiles = getAllChatbotProfiles(session.user.githubId);
    // Ensure default profile is included (but don't force it as the selected one)
    const allProfiles = profiles.find(p => p.id === "default") 
      ? profiles 
      : [DEFAULT_CHATBOT_PROFILE, ...profiles];
    const currentProfileId = getCurrentChatbotProfileId(session.user.githubId);
    return NextResponse.json({ profiles: allProfiles, currentProfileId });
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

    // Delete from local storage
    const { deleteChatbotProfile } = await import("@/lib/storage");
    deleteChatbotProfile(session.user.githubId, profileId);

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

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentProfileId } = await req.json();
    if (!currentProfileId) {
      return NextResponse.json({ error: "Current profile ID is required" }, { status: 400 });
    }

    let profiles = getAllChatbotProfiles(session.user.githubId);
    let profileExists = profiles.some((profile) => profile.id === currentProfileId);

    if (!profileExists && session.user.accessToken) {
      try {
        const githubProfiles = await getProfilesFromGitHub(session.user.accessToken);
        if (Array.isArray(githubProfiles) && githubProfiles.length > 0) {
          profileExists = githubProfiles.some((profile) => profile.id === currentProfileId);
          if (profileExists) {
            profiles = [
              ...profiles,
              ...githubProfiles.filter(
                (profile) => profile.id === currentProfileId && !profiles.some((p) => p.id === profile.id)
              ),
            ];
          }
        }
      } catch (error) {
        console.error("Error checking GitHub profiles:", error);
      }
    }

    if (!profileExists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    setCurrentChatbotProfileId(session.user.githubId, currentProfileId);

    return NextResponse.json({ success: true, currentProfileId });
  } catch (error) {
    console.error("Chatbot profiles PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to set current profile" },
      { status: 500 }
    );
  }
}

