"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { cache } from "./indexeddb";
import { syncService } from "./sync";
import { JournalEntry, ChatbotProfile, UserApiSettings } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";

interface CacheContextValue {
  journalEntries: JournalEntry[];
  chatbotProfiles: ChatbotProfile[];
  userSettings: UserApiSettings | null;
  isLoading: boolean;
  isInitialized: boolean;
  refreshJournalEntries: () => Promise<void>;
  refreshChatbotProfiles: () => Promise<void>;
  refreshUserSettings: () => Promise<void>;
  sync: (incremental?: boolean) => Promise<void>;
}

const CacheContext = createContext<CacheContextValue | undefined>(undefined);

export function CacheProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [chatbotProfiles, setChatbotProfiles] = useState<ChatbotProfile[]>([]);
  const [userSettings, setUserSettings] = useState<UserApiSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const userId = session?.user?.githubId;
  const accessToken = session?.user?.accessToken;

  // Load data from cache
  const loadFromCache = async () => {
    if (!userId || typeof window === "undefined") return;

    try {
      const [entries, profiles, settings] = await Promise.all([
        cache.getAllJournalEntries(userId).catch(() => []),
        cache.getAllChatbotProfiles(userId).catch(() => []),
        cache.getUserSettings(userId).catch(() => null),
      ]);

      setJournalEntries(entries);
      
      // Ensure default chatbot is always included
      const hasDefault = profiles.some((p) => p.id === "default");
      const profilesWithDefault = hasDefault
        ? profiles
        : [{ ...DEFAULT_CHATBOT_PROFILE, isCurrent: false }, ...profiles];
      
      setChatbotProfiles(profilesWithDefault);
      setUserSettings(settings);
    } catch (error) {
      console.error("Error loading from cache:", error);
    }
  };

  // Initial sync on mount
  useEffect(() => {
    if (status === "loading") return; // Wait for auth to resolve

    const initialize = async () => {
      if (!userId || !accessToken) {
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        setIsLoading(true);

        // Load from cache first (instant display)
        await loadFromCache();

        // Then sync with GitHub in background
        try {
          const metadata = await cache.getSyncMetadata(userId);
          if (metadata) {
            // Incremental sync if we have previous sync data
            await syncService.incrementalSync(userId, accessToken);
          } else {
            // Full sync on first load
            await syncService.fullSync(userId, accessToken);
          }
        } catch (syncError) {
          console.error("Sync error (non-fatal):", syncError);
          // Continue even if sync fails - we have cached data
        }

        // Reload from cache after sync
        await loadFromCache();
      } catch (error) {
        console.error("Error initializing cache:", error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    initialize();
  }, [userId, accessToken, status]);

  // Refresh functions
  const refreshJournalEntries = async () => {
    if (!userId) return;
    const entries = await cache.getAllJournalEntries(userId);
    setJournalEntries(entries);
  };

  const refreshChatbotProfiles = async () => {
    if (!userId) return;
    const profiles = await cache.getAllChatbotProfiles(userId);
    
    // Ensure default chatbot is always included
    const hasDefault = profiles.some((p) => p.id === "default");
    const profilesWithDefault = hasDefault
      ? profiles
      : [{ ...DEFAULT_CHATBOT_PROFILE, isCurrent: false }, ...profiles];
    
    setChatbotProfiles(profilesWithDefault);
  };

  const refreshUserSettings = async () => {
    if (!userId) return;
    const settings = await cache.getUserSettings(userId);
    setUserSettings(settings);
  };

  // Sync function
  const sync = async (incremental = true) => {
    if (!userId || !accessToken) return;

    try {
      if (incremental) {
        await syncService.incrementalSync(userId, accessToken);
      } else {
        await syncService.fullSync(userId, accessToken);
      }

      // Reload from cache
      await loadFromCache();
    } catch (error) {
      console.error("Error syncing:", error);
    }
  };

  // Clear cache on logout
  useEffect(() => {
    if (status === "unauthenticated" && userId) {
      cache.clearUserData(userId).catch(console.error);
      setJournalEntries([]);
      setChatbotProfiles([]);
      setUserSettings(null);
      setIsInitialized(false);
    }
  }, [status, userId]);

  return (
    <CacheContext.Provider
      value={{
        journalEntries,
        chatbotProfiles,
        userSettings,
        isLoading,
        isInitialized,
        refreshJournalEntries,
        refreshChatbotProfiles,
        refreshUserSettings,
        sync,
      }}
    >
      {children}
    </CacheContext.Provider>
  );
}

export function useCache() {
  const context = useContext(CacheContext);
  if (context === undefined) {
    throw new Error("useCache must be used within a CacheProvider");
  }
  return context;
}

