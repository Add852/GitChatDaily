import { Octokit } from "@octokit/rest";
import { ConversationMessage, HighlightItem, JournalEntry } from "@/types";

const REPO_NAME = "gitchat-journal";
const ENTRIES_PATH = "entries";

export async function fetchJournalEntriesFromGitHub(
  accessToken: string,
  githubId: string
): Promise<JournalEntry[]> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;

  try {
    await octokit.repos.get({ owner: username, repo: REPO_NAME });
  } catch (error: any) {
    if (error.status === 404) {
      return [];
    }
    throw error;
  }

  const timestampNow = new Date().toISOString();

  try {
    const { data: contents } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path: ENTRIES_PATH,
    });

    if (Array.isArray(contents)) {
      const entryFiles = contents.filter(
        (item) => item.type === "file" && item.name.endsWith(".md")
      );

      // Fetch all entry files in parallel (much faster than sequential)
      const BATCH_SIZE = 10; // Limit concurrent requests to avoid rate limiting
      const entries: JournalEntry[] = [];
      
      for (let i = 0; i < entryFiles.length; i += BATCH_SIZE) {
        const batch = entryFiles.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            try {
              const { data: fileData } = await octokit.repos.getContent({
                owner: username,
                repo: REPO_NAME,
                path: file.path,
              });

              if ("content" in fileData) {
                const content = Buffer.from(fileData.content, "base64").toString("utf-8");
                const parsed =
                  parseStructuredEntry(content) ?? parseLegacyEntry(content, file.name.replace(".md", ""));

                if (parsed) {
                  return {
                    id: `${githubId}-${parsed.date}`,
                    date: parsed.date,
                    highlights: parsed.highlights,
                    summary: parsed.summary,
                    conversation: parsed.conversation,
                    mood: parsed.mood,
                    chatbotProfileId: "default",
                    chatbotProfileName: parsed.chatbotProfileName,
                    createdAt: parsed.createdAt ?? timestampNow,
                    updatedAt: timestampNow,
                  } as JournalEntry;
                }
              }
              return null;
            } catch (error) {
              console.error(`Error loading entry ${file.name}:`, error);
              return null;
            }
          })
        );
        
        // Filter out nulls and add to entries
        entries.push(...batchResults.filter((e): e is JournalEntry => e !== null));
      }

      return entries.sort((a, b) => b.date.localeCompare(a.date));
    }
  } catch (error: any) {
    if (error.status !== 404) {
      console.error("Error fetching entries from GitHub:", error);
    }
  }

  return [];
}

export async function deleteJournalEntryFromGitHub(accessToken: string, date: string): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const username = user.login;
  const path = `${ENTRIES_PATH}/${date}.md`;

  try {
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: REPO_NAME,
      path,
    });

    if (!("sha" in data)) {
      return;
    }

    await octokit.repos.deleteFile({
      owner: username,
      repo: REPO_NAME,
      path,
      message: `Delete journal entry for ${date}`,
      sha: data.sha,
    });
  } catch (error: any) {
    if (error.status !== 404) {
      throw error;
    }
  }
}

interface ParsedJournalFile {
  date: string;
  mood: number;
  summary: string;
  highlights: HighlightItem[];
  conversation: ConversationMessage[];
  chatbotProfileName: string;
  createdAt?: string;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function parseStructuredEntry(content: string): ParsedJournalFile | null {
  const normalized = normalizeNewlines(content);
  const frontMatterMatch = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);

  if (!frontMatterMatch) {
    return null;
  }

  const metadataRaw = frontMatterMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const metadata: Record<string, string> = {};
  for (const line of metadataRaw) {
    const [key, ...rest] = line.split(":");
    if (!key) continue;
    metadata[key.trim()] = rest.join(":").trim();
  }

  const date = metadata.date;
  if (!date) {
    return null;
  }

  const body = normalized.slice(frontMatterMatch[0].length);
  const highlightsMatch = body.match(/### Highlights\s+([\s\S]*?)\n### Summary/);
  const summaryMatch = body.match(/### Summary\s+([\s\S]*?)\n---/);
  const conversationMatch = body.match(/### Conversation\s+([\s\S]*?)\n---/);

  return {
    date,
    mood: parseInt(metadata.mood || "3", 10) || 3,
    summary: summaryMatch?.[1]?.trim() || "",
    highlights: parseHighlightsSection(highlightsMatch?.[1] ?? ""),
    conversation: parseConversationSection(conversationMatch?.[1] ?? ""),
    chatbotProfileName: metadata.chatbot || "GitChat Companion",
    createdAt: metadata.createdAt,
  };
}

function parseLegacyEntry(content: string, fallbackDate: string): ParsedJournalFile | null {
  const normalized = normalizeNewlines(content);
  const lines = normalized.split("\n");
  const headerMatch = lines[0]?.match(/# Journal Entry - (\d{4}-\d{2}-\d{2})/);
  const date = headerMatch?.[1] || fallbackDate;

  if (!date) {
    return null;
  }

  const moodMatch = normalized.match(/\*Mood: (\d)\/5\*/);
  const mood = moodMatch ? parseInt(moodMatch[1], 10) : 3;
  const separatorIndex = normalized.indexOf("---");
  const summary =
    separatorIndex > 0
      ? normalized.substring(lines[0].length, separatorIndex).trim()
      : normalized.substring(lines[0].length).trim();

  return {
    date,
    mood,
    summary,
    highlights: [],
    conversation: [],
    chatbotProfileName: "GitChat Companion",
  };
}

function parseHighlightsSection(section: string): HighlightItem[] {
  if (!section) {
    return [];
  }

  const highlights: HighlightItem[] = [];
  const regex = /^- \*\*(.+?):\*\*\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(section)) !== null) {
    const title = match[1]?.trim();
    const description = match[2]?.trim();

    if (title && description) {
      highlights.push({ title, description });
    }
  }

  return highlights;
}

function parseConversationSection(section: string): ConversationMessage[] {
  if (!section) {
    return [];
  }

  const messages: ConversationMessage[] = [];
  const regex = /\*\*(You|AI):\*\*\s*([\s\S]*?)(?=\n\n\*\*(You|AI):\*\*|$)/g;
  let match: RegExpExecArray | null;
  const timestampBase = Date.now();

  while ((match = regex.exec(section)) !== null) {
    const speaker = match[1];
    const content = match[2]?.trim();
    if (!speaker || !content) continue;

    messages.push({
      role: speaker === "You" ? "user" : "assistant",
      content,
      timestamp: new Date(timestampBase + messages.length).toISOString(),
    });
  }

  return messages;
}

