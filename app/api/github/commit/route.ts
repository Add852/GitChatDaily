import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Octokit } from "@octokit/rest";
import { readFileSync } from "fs";
import { join } from "path";
import { ConversationMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date, summary, mood, conversation = [], chatbotProfileName, summarySections } = await req.json();

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

    const templatePath = join(process.cwd(), "lib", "templates", "entry-template.md");
    let template = "";
    try {
      template = readFileSync(templatePath, "utf-8");
    } catch (error) {
      template = `# ${date} 🙂
---
date: ${date}
mood: ${mood}
chatbot: ${chatbotProfileName || "Companion"}
---

### Highlights
${summary}

### Summary
${summary}

---

### Conversation
${summary}


---

*Created with GitChat Journal*`;
    }

    const highlightsMarkdown =
      Array.isArray(summarySections?.highlights) && summarySections.highlights.length > 0
        ? summarySections.highlights.map((item: string) => `- ${item}`).join("\n")
        : "- No highlights recorded.";

    const summaryMarkdown =
      summarySections?.summary && summarySections.summary.length > 0
        ? summarySections.summary
        : summary;

    const conversationMarkdown =
      Array.isArray(conversation) && conversation.length > 0
        ? (conversation as ConversationMessage[])
            .map((message) => {
              const speaker = message.role === "user" ? "You" : chatbotProfileName || "Companion";
              return `**${speaker}:** ${message.content}`;
            })
            .join("\n\n")
        : "_Conversation unavailable._";

    const moodEmoji = ["😢", "😕", "😐", "🙂", "😄"][mood - 1] || "😐";
    const replacements: [string, string][] = [
      ["${YYYY-MM-DD}", date],
      ["${INT: mood value from 1 to 5}", String(mood)],
      ["${STRING: chatbot profile that was used}", chatbotProfileName || "Companion"],
      ["${Bulleted summary of today's happenings}", highlightsMarkdown],
      ["${Concise paragraph summary narrating/describing what happened today}", summaryMarkdown],
      ["${the full transcript of the conversation here}", conversationMarkdown],
    ];

    let content = template;
    replacements.forEach(([token, value]) => {
      content = content.replaceAll(token, value);
    });

    const headerWithPlaceholder = `# ${date} 🙂`;
    if (content.includes(headerWithPlaceholder)) {
      content = content.replace(headerWithPlaceholder, `# ${date} ${moodEmoji}`);
    }

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

