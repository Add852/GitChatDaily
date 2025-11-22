export interface HighlightItem {
  title: string;
  description: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  highlights: HighlightItem[];
  summary: string;
  conversation: ConversationMessage[];
  mood: number;
  chatbotProfileId: string;
  chatbotProfileName: string;
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
  responseCount?: number;
  isCurrent?: boolean;
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

export type ApiProvider = "ollama" | "openrouter" | "gemini";

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export interface GeminiModel {
  id: string;
  name: string;
  description?: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

export interface UserApiSettings {
  provider: ApiProvider;
  openRouterApiKey?: string;
  openRouterModel?: string;
  ollamaApiUrl?: string;
  ollamaModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
}

export interface ApiStatus {
  available: boolean;
  provider: ApiProvider;
  error?: string;
  lastChecked?: string;
}

