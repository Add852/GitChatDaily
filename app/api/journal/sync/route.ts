import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Octokit } from "@octokit/rest";
import { saveJournalEntry } from "@/lib/storage";
import { JournalEntry } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accessToken || !session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const octokit = new Octokit({
      auth: session.user.accessToken,
    });

    // Get user info
    const { data: user } = await octokit.users.getAuthenticated();
    const username = user.login;
    const repoName = "gitchat-journal";

    // Try to get the repository
    try {
      await octokit.repos.get({ owner: username, repo: repoName });
    } catch (error: any) {
      if (error.status === 404) {
        // Repository doesn't exist, nothing to sync
        return NextResponse.json({ synced: 0, message: "Repository not found" });
      }
      throw error;
    }

    // Get all entries from the entries directory
    let syncedCount = 0;
    try {
      const { data: contents } = await octokit.repos.getContent({
        owner: username,
        repo: repoName,
        path: "entries",
      });

      if (Array.isArray(contents)) {
        // Get all markdown files
        const entryFiles = contents.filter(
          (item) => item.type === "file" && item.name.endsWith(".md")
        );

        for (const file of entryFiles) {
          try {
            const { data: fileData } = await octokit.repos.getContent({
              owner: username,
              repo: repoName,
              path: file.path,
            });

            if ("content" in fileData) {
              const content = Buffer.from(fileData.content, "base64").toString("utf-8");
              
              // Parse the markdown file
              // Format: # Journal Entry - YYYY-MM-DD 😊
              // [summary content]
              // ---
              // *Mood: X/5*
              
              const lines = content.split("\n");
              const headerMatch = lines[0]?.match(/# Journal Entry - (\d{4}-\d{2}-\d{2})/);
              if (!headerMatch) continue;

              const date = headerMatch[1];
              const moodMatch = content.match(/\*Mood: (\d)\/5\*/);
              const mood = moodMatch ? parseInt(moodMatch[1]) : 3;

              // Extract summary (everything between header and ---)
              const separatorIndex = content.indexOf("---");
              const summary = separatorIndex > 0
                ? content
                    .substring(lines[0].length, separatorIndex)
                    .trim()
                : content.substring(lines[0].length).trim();

              // Create entry
              const entry: JournalEntry = {
                id: `${session.user.githubId}-${date}`,
                date,
                summary,
                conversation: [], // We don't store conversation in GitHub files
                mood,
                chatbotProfileId: "default",
                createdAt: fileData.sha ? new Date().toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              saveJournalEntry(session.user.githubId, entry);
              syncedCount++;
            }
          } catch (error) {
            console.error(`Error syncing file ${file.name}:`, error);
            // Continue with other files
          }
        }
      }
    } catch (error: any) {
      if (error.status !== 404) {
        // 404 means entries directory doesn't exist yet, which is fine
        console.error("Error syncing entries:", error);
      }
    }

    return NextResponse.json({ synced: syncedCount, message: `Synced ${syncedCount} entries` });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync entries from GitHub" },
      { status: 500 }
    );
  }
}

