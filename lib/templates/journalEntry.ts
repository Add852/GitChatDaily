import { ConversationMessage, HighlightItem } from "@/types";
import { MOOD_OPTIONS } from "@/lib/constants";

interface BuildJournalEntryParams {
  date: string;
  mood: number;
  chatbotName: string;
  highlights: HighlightItem[];
  summary: string;
  conversation: ConversationMessage[];
}

export function getMoodEmoji(mood: number): string {
  return MOOD_OPTIONS.find((option) => option.value === mood)?.emoji ?? "😐";
}

export function buildJournalEntryMarkdown({
  date,
  mood,
  chatbotName,
  highlights,
  summary,
  conversation,
}: BuildJournalEntryParams): string {
  const emoji = getMoodEmoji(mood);
  const sanitizedSummary = summary?.trim() || "_Summary not available._";

  const sections = [
    "---",
    `date: ${date}`,
    `mood: ${mood}`,
    `chatbot: ${chatbotName}`,
    "---",
    "",
    `# ${date} ${emoji}`,
    "",
    "### Highlights",
    formatHighlights(highlights),
    "",
    "### Summary",
    sanitizedSummary,
    "",
    "---",
    "",
    "### Conversation",
    formatConversation(conversation),
    "",
    "---",
    "",
    "*Created with GitChat Journal*",
    "",
  ];

  return sections.join("\n");
}

function formatHighlights(highlights: HighlightItem[]): string {
  if (!highlights?.length) {
    return "- _Highlights not captured._";
  }

  return highlights
    .map((item, index) => {
      const title = item?.title?.trim() || `Highlight ${index + 1}`;
      const description = item?.description?.trim() || "_No description provided._";
      return `- **${title}:** ${description}`;
    })
    .join("\n");
}

function formatConversation(conversation: ConversationMessage[]): string {
  if (!conversation?.length) {
    return "_Conversation transcript unavailable._";
  }

  return conversation
    .map((message) => {
      const speaker = message.role === "user" ? "You" : "AI";
      const content = message.content?.trim() || "";
      if (!content) {
        return "";
      }
      return `**${speaker}:** ${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

