import { MoodOption } from "@/types";

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, emoji: "😢", label: "Very Sad", color: "#ebedf0" },
  { value: 2, emoji: "😕", label: "Sad", color: "#9be9a8" },
  { value: 3, emoji: "😐", label: "Neutral", color: "#40c463" },
  { value: 4, emoji: "🙂", label: "Happy", color: "#30a14e" },
  { value: 5, emoji: "😄", label: "Very Happy", color: "#216e39" },
];

export const DEFAULT_CHATBOT_PROFILE = {
  id: "default",
  name: "Empathetic Friend",
  description: "A caring and understanding friend who listens and provides support",
  systemPrompt: `A caring and understanding friend who listens and provides support`,
  isDefault: true,
  createdAt: new Date().toISOString(),
};

export const CONTRIBUTION_GRAPH_COLORS = {
  0: "#ebedf0", // No entry
  1: "#ebedf0", // Very Sad
  2: "#9be9a8", // Sad
  3: "#40c463", // Neutral
  4: "#30a14e", // Happy
  5: "#216e39", // Very Happy
};

