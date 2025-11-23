import { MoodOption } from "@/types";

export const RESPONSE_COUNT_MIN = 2;
export const RESPONSE_COUNT_MAX = 10;
export const DEFAULT_RESPONSE_COUNT = 4;

export function clampResponseCount(value?: number): number {
  const numericValue =
    typeof value === "number" && !Number.isNaN(value) ? Math.round(value) : DEFAULT_RESPONSE_COUNT;
  return Math.min(
    RESPONSE_COUNT_MAX,
    Math.max(RESPONSE_COUNT_MIN, numericValue ?? DEFAULT_RESPONSE_COUNT)
  );
}

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, emoji: "😢", label: "Very Sad", color: "#6b7280" },
  { value: 2, emoji: "😕", label: "Sad", color: "#86efac" },
  { value: 3, emoji: "😐", label: "Neutral", color: "#4ade80" },
  { value: 4, emoji: "🙂", label: "Happy", color: "#22c55e" },
  { value: 5, emoji: "😄", label: "Very Happy", color: "#15803d" },
];

export const DEFAULT_CHATBOT_PROFILE = {
  id: "default",
  name: "Journal Buddy",
  description: "Highlight, Problem, and Gratitude for today",
  systemPrompt: `You are a chatbot designed to help users document their day to gather three key pieces of information:
- Today's highlight or standout moment/s
- A problem/s they dealt with today
- Something/s they're grateful for

You may ask follow-up questions when helpful, but stay focused on collecting enough concrete detail to craft a meaningful journal entry that helps the user remember their day.`,
  responseCount: DEFAULT_RESPONSE_COUNT,
  isCurrent: true,
  createdAt: new Date().toISOString(),
};

export const CONTRIBUTION_GRAPH_COLORS = {
  0: "#161b22", // No entry
  1: "#6b7280", // Very Sad
  2: "#86efac", // Sad
  3: "#4ade80", // Neutral
  4: "#22c55e", // Happy
  5: "#15803d", // Very Happy
};

