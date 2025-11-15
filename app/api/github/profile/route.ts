import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Octokit } from "@octokit/rest";
import { ChatbotProfile } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile: ChatbotProfile = await req.json();

    const octokit = new Octokit({
      auth: session.user.accessToken,
    });

    // Get user info
    const { data: user } = await octokit.users.getAuthenticated();
    const username = user.login;

    // Repository name for journal entries
    const repoName = "gitchat-journal";
    const fileName = `profiles/${profile.id}.json`;

    // Try to create repo if it doesn't exist
    try {
      await octokit.repos.get({ owner: username, repo: repoName });
    } catch (error: any) {
      if (error.status === 404) {
        // Create the repository
        await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          description: "GitChat Journal - Daily journal entries",
          private: true,
          auto_init: true,
        });
      }
    }

    // Get file content if it exists
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner: username,
        repo: repoName,
        path: fileName,
      });
      if ("sha" in data) {
        sha = data.sha;
      }
    } catch (error: any) {
      // File doesn't exist, that's okay
    }

    // Create or update the file
    const content = JSON.stringify(profile, null, 2);
    const contentBase64 = Buffer.from(content).toString("base64");

    await octokit.repos.createOrUpdateFileContents({
      owner: username,
      repo: repoName,
      path: fileName,
      message: `Save chatbot profile: ${profile.name}`,
      content: contentBase64,
      sha: sha,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("GitHub profile save error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save profile to GitHub" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("id");

    const octokit = new Octokit({
      auth: session.user.accessToken,
    });

    // Get user info
    const { data: user } = await octokit.users.getAuthenticated();
    const username = user.login;
    const repoName = "gitchat-journal";

    // If specific profile ID requested
    if (profileId) {
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner: username,
          repo: repoName,
          path: `profiles/${profileId}.json`,
        });
        
        if ("content" in fileData) {
          const content = Buffer.from(fileData.content, "base64").toString("utf-8");
          const profile = JSON.parse(content) as ChatbotProfile;
          return NextResponse.json(profile);
        }
      } catch (error: any) {
        if (error.status === 404) {
          return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }
        throw error;
      }
    }

    // Get all profiles from GitHub
    try {
      const { data } = await octokit.repos.getContent({
        owner: username,
        repo: repoName,
        path: "profiles",
      });

      if (Array.isArray(data)) {
        const profiles: ChatbotProfile[] = [];
        
        for (const item of data) {
          if (item.type === "file" && item.name.endsWith(".json")) {
            try {
              const { data: fileData } = await octokit.repos.getContent({
                owner: username,
                repo: repoName,
                path: item.path,
              });
              
              if ("content" in fileData) {
                const content = Buffer.from(fileData.content, "base64").toString("utf-8");
                const profile = JSON.parse(content) as ChatbotProfile;
                profiles.push(profile);
              }
            } catch (e) {
              console.error(`Error reading profile ${item.name}:`, e);
            }
          }
        }
        
        return NextResponse.json(profiles);
      }
    } catch (error: any) {
      if (error.status === 404) {
        // Profiles folder doesn't exist yet, return empty array
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json([]);
  } catch (error: any) {
    console.error("GitHub profile fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch profiles from GitHub" },
      { status: 500 }
    );
  }
}

