import { MoodOption } from "@/types";

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, emoji: "😢", label: "Very Sad", color: "#6b7280" },
  { value: 2, emoji: "😕", label: "Sad", color: "#86efac" },
  { value: 3, emoji: "😐", label: "Neutral", color: "#4ade80" },
  { value: 4, emoji: "🙂", label: "Happy", color: "#22c55e" },
  { value: 5, emoji: "😄", label: "Very Happy", color: "#15803d" },
];

export const DEFAULT_CHATBOT_PROFILE = {
  id: "default",
  name: "Empathetic Friend",
  description: "A caring and understanding friend who listens and provides support",
  systemPrompt: `A caring and understanding friend who listens and provides support`,
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

