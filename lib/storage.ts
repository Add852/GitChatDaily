import { JournalEntry, ChatbotProfile } from "@/types";
import { DEFAULT_CHATBOT_PROFILE, clampResponseCount } from "./constants";

// In-memory storage for development
// In production, this should be replaced with a database
let journalEntries: Map<string, JournalEntry> = new Map();
let chatbotProfiles: Map<string, ChatbotProfile> = new Map();
let userCurrentProfiles: Map<string, string> = new Map();

const normalizeProfile = (profile: ChatbotProfile): ChatbotProfile => ({
  ...profile,
  responseCount: clampResponseCount(profile.responseCount),
});

// Initialize default chatbot profile
chatbotProfiles.set(
  "default",
  normalizeProfile({
    ...DEFAULT_CHATBOT_PROFILE,
    createdAt: new Date().toISOString(),
  })
);

export function getJournalEntry(userId: string, date: string): JournalEntry | null {
  const key = `${userId}-${date}`;
  const entry = journalEntries.get(key);
  return entry || null;
}

export function saveJournalEntry(userId: string, entry: JournalEntry): void {
  const key = `${userId}-${entry.date}`;
  journalEntries.set(key, entry);
}

export function getAllJournalEntries(userId: string): JournalEntry[] {
  const entries: JournalEntry[] = [];
  for (const [key, entry] of journalEntries.entries()) {
    if (key.startsWith(`${userId}-`)) {
      entries.push(entry);
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export function getJournalEntriesByYear(userId: string, year: number): Map<string, JournalEntry> {
  const entries = new Map<string, JournalEntry>();
  for (const [key, entry] of journalEntries.entries()) {
    if (key.startsWith(`${userId}-`) && entry.date.startsWith(`${year}-`)) {
      entries.set(entry.date, entry);
    }
  }
  return entries;
}

export function getChatbotProfile(profileId: string): ChatbotProfile | null {
  const profile = chatbotProfiles.get(profileId);
  return profile ? normalizeProfile(profile) : null;
}

export function getAllChatbotProfiles(userId: string): ChatbotProfile[] {
  // For now, return all profiles. In production, filter by userId
  return Array.from(chatbotProfiles.values()).map(normalizeProfile);
}

export function saveChatbotProfile(userId: string, profile: ChatbotProfile): void {
  chatbotProfiles.set(profile.id, normalizeProfile(profile));
}

export function deleteJournalEntry(userId: string, date: string): void {
  const key = `${userId}-${date}`;
  journalEntries.delete(key);
}

export function deleteChatbotProfile(userId: string, profileId: string): void {
  chatbotProfiles.delete(profileId);
  const currentId = userCurrentProfiles.get(userId);
  if (currentId === profileId) {
    userCurrentProfiles.set(userId, "default");
  }
}

export function getCurrentChatbotProfileId(userId: string): string {
  return userCurrentProfiles.get(userId) || "default";
}

export function setCurrentChatbotProfileId(userId: string, profileId: string): void {
  userCurrentProfiles.set(userId, profileId);
}

