import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getAllChatbotProfiles,
  setCurrentChatbotProfileId,
} from "@/lib/storage";
import {
  getProfilesFromGitHub,
  saveCurrentProfileIdToGitHub,
} from "@/app/api/github/profile-helpers";
import { ChatbotProfile } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profileId } = await req.json();
    if (!profileId) {
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 });
    }

    const userId = session.user.githubId;
    let profiles: ChatbotProfile[] = [];

    if (session.user.accessToken) {
      try {
        profiles = await getProfilesFromGitHub(session.user.accessToken);
      } catch (error) {
        console.error("Error fetching profiles from GitHub while setting current:", error);
      }
    }

    if (profiles.length === 0) {
      profiles = getAllChatbotProfiles(userId);
    }

    const profileExists =
      profileId === "default" ||
      profiles.some((profile) => profile.id === profileId);

    if (!profileExists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    setCurrentChatbotProfileId(userId, profileId);

    if (session.user.accessToken) {
      try {
        await saveCurrentProfileIdToGitHub(session.user.accessToken, profileId);
      } catch (error) {
        console.error("Error saving current profile to GitHub:", error);
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

