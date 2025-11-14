import { MoodOption } from "@/types";

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, emoji: "😢", label: "Very Sad", color: "#4b5563" },
  { value: 2, emoji: "😕", label: "Sad", color: "#6b7280" },
  { value: 3, emoji: "😐", label: "Neutral", color: "#9ca3af" },
  { value: 4, emoji: "🙂", label: "Happy", color: "#34d399" },
  { value: 5, emoji: "😄", label: "Very Happy", color: "#059669" },
];

export const DEFAULT_CHATBOT_PROFILE = {
  id: "default",
  name: "Empathetic Friend",
  description: "A caring and understanding friend who listens and provides support",
  systemPrompt: `a concise but efficient and articulate person that likes to use minimal amount of words to get message across. It likes to use shortend or concatenated words and phrase like wyd, otw, btw, using "y" instead of "why" usually used in texting/chatting linggo.`,
  isDefault: true,
  createdAt: new Date().toISOString(),
};

export const CONTRIBUTION_GRAPH_COLORS = {
  0: "#374151", // No entry
  1: "#4b5563", // Very Sad
  2: "#6b7280", // Sad
  3: "#9ca3af", // Neutral
  4: "#34d399", // Happy
  5: "#059669", // Very Happy
};

