import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Octokit } from "@octokit/rest";
import { ConversationMessage, HighlightItem } from "@/types";
import { buildJournalEntryMarkdown } from "@/lib/templates/journalEntry";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      date,
      summary,
      highlights,
      mood,
      conversation,
      chatbotProfileName,
    } = await req.json();

    if (!date || typeof summary !== "string" || typeof mood !== "number") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedHighlights: HighlightItem[] = Array.isArray(highlights)
      ? highlights
          .map((item: HighlightItem, index: number) => ({
            title:
              typeof item?.title === "string" && item.title.trim().length > 0
                ? item.title.trim()
                : `Highlight ${index + 1}`,
            description:
              typeof item?.description === "string" && item.description.trim().length > 0
                ? item.description.trim()
                : "",
          }))
          .filter((item) => item.description.length > 0)
      : [];

    const normalizedConversation: ConversationMessage[] = Array.isArray(conversation)
      ? conversation
          .map((message: ConversationMessage) => {
            if (
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string"
            ) {
              return {
                role: message.role,
                content: message.content,
                timestamp: message.timestamp ?? new Date().toISOString(),
              };
            }
            return null;
          })
          .filter((message): message is ConversationMessage => Boolean(message))
      : [];

    const octokit = new Octokit({
      auth: session.user.accessToken,
    });

    // Get user info
    const { data: user } = await octokit.users.getAuthenticated();
    const username = user.login;

    // Repository name for journal entries
    const repoName = "gitchat-journal";
    const fileName = `entries/${date}.md`;

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

    const content = buildJournalEntryMarkdown({
      date,
      mood,
      chatbotName: chatbotProfileName || "GitChat Companion",
      highlights: normalizedHighlights,
      summary,
      conversation: normalizedConversation,
    });

    const contentBase64 = Buffer.from(content).toString("base64");

    await octokit.repos.createOrUpdateFileContents({
      owner: username,
      repo: repoName,
      path: fileName,
      message: `Journal entry for ${date} (Mood: ${mood}/5)`,
      content: contentBase64,
      sha: sha,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("GitHub commit error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create GitHub commit" },
      { status: 500 }
    );
  }
}

