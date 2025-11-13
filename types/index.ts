export interface JournalEntry {
  id: string;
  date: string;
  summary: string;
  conversation: ConversationMessage[];
  mood: number;
  chatbotProfileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatbotProfile {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  isDefault: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  githubId: string;
  username: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
}

export interface MoodOption {
  value: number;
  emoji: string;
  label: string;
  color: string;
}

