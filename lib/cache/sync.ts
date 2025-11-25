import { cache } from "./indexeddb";
import { JournalEntry, ChatbotProfile } from "@/types";
import { fetchJournalEntriesFromGitHub } from "@/lib/github-journal";
import {
  getChatbotsFromGitHub,
  getCurrentChatbotIdFromGitHub,
} from "@/app/api/github/chatbot-helpers";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";

interface SyncResult {
  journalEntries: {
    added: number;
    updated: number;
    deleted: number;
  };
  chatbotProfiles: {
    added: number;
    updated: number;
    deleted: number;
  };
  success: boolean;
  error?: string;
}

export class SyncService {
  /**
   * Full sync - fetches all data from GitHub and caches it
   */
  async fullSync(userId: string, accessToken: string): Promise<SyncResult> {
    try {
      // Fetch all data in parallel for faster loading
      const [journalEntries, chatbots, currentChatbotId] = await Promise.all([
        fetchJournalEntriesFromGitHub(accessToken, userId).catch(() => []),
        getChatbotsFromGitHub(accessToken).catch(() => []),
        getCurrentChatbotIdFromGitHub(accessToken).catch(() => null),
      ]);

      // Save journal entries and chatbot profiles in parallel
      const journalPromise = journalEntries.length > 0 
        ? cache.saveJournalEntries(journalEntries.map((entry) => ({ ...entry, userId })))
        : Promise.resolve();
      
      // Always include default chatbot, then add GitHub chatbots (excluding default if it exists)
      const allChatbots: (ChatbotProfile & { userId: string })[] = [
        {
          ...DEFAULT_CHATBOT_PROFILE,
          userId,
          isCurrent: currentChatbotId === "default" || !currentChatbotId,
        },
        ...chatbots
          .filter((profile) => profile.id !== "default")
          .map((profile) => ({
            ...profile,
            userId,
            isCurrent: profile.id === currentChatbotId,
          })),
      ];

      const chatbotsPromise = cache.saveChatbotProfiles(allChatbots);

      // Wait for both saves to complete
      await Promise.all([journalPromise, chatbotsPromise]);

      // Update sync metadata
      const now = new Date().toISOString();
      await cache.updateSyncMetadata({
        userId,
        lastSyncTime: now,
        lastJournalSyncTime: now,
        lastProfileSyncTime: now,
      });

      return {
        journalEntries: {
          added: journalEntries.length,
          updated: 0,
          deleted: 0,
        },
        chatbotProfiles: {
          added: allChatbots.length,
          updated: 0,
          deleted: 0,
        },
        success: true,
      };
    } catch (error) {
      console.error("Full sync error:", error);
      return {
        journalEntries: { added: 0, updated: 0, deleted: 0 },
        chatbotProfiles: { added: 0, updated: 0, deleted: 0 },
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Incremental sync - only fetches changes since last sync
   */
  async incrementalSync(userId: string, accessToken: string): Promise<SyncResult> {
    try {
      const metadata = await cache.getSyncMetadata(userId);
      
      // If no metadata, do a full sync
      if (!metadata) {
        return this.fullSync(userId, accessToken);
      }

      // Fetch all data in parallel (GitHub + cache)
      const [githubEntries, githubChatbots, currentChatbotId, cachedEntries, cachedProfiles] = await Promise.all([
        fetchJournalEntriesFromGitHub(accessToken, userId).catch(() => []),
        getChatbotsFromGitHub(accessToken).catch(() => []),
        getCurrentChatbotIdFromGitHub(accessToken).catch(() => null),
        cache.getAllJournalEntries(userId).catch(() => []),
        cache.getAllChatbotProfiles(userId).catch(() => []),
      ]);

      // Create maps for quick lookup
      const cachedEntriesMap = new Map(cachedEntries.map((e) => [e.date, e]));
      const githubEntriesMap = new Map(githubEntries.map((e) => [e.date, e]));

      // Find added/updated entries
      const entriesToSave: (JournalEntry & { userId: string })[] = [];
      let added = 0;
      let updated = 0;

      for (const githubEntry of githubEntries) {
        const cachedEntry = cachedEntriesMap.get(githubEntry.date);
        if (!cachedEntry) {
          // New entry
          added++;
          entriesToSave.push({ ...githubEntry, userId });
        } else if (
          new Date(githubEntry.updatedAt) > new Date(cachedEntry.updatedAt)
        ) {
          // Updated entry
          updated++;
          entriesToSave.push({ ...githubEntry, userId });
        }
      }

      // Find deleted entries (in cache but not in GitHub)
      const entriesToDelete: string[] = [];
      for (const cachedEntry of cachedEntries) {
        if (!githubEntriesMap.has(cachedEntry.date)) {
          entriesToDelete.push(cachedEntry.date);
        }
      }

      // Batch delete entries
      let deleted = 0;
      for (const date of entriesToDelete) {
        await cache.deleteJournalEntry(userId, date);
        deleted++;
      }

      // Save updated entries
      if (entriesToSave.length > 0) {
        await cache.saveJournalEntries(entriesToSave);
      }

      const cachedProfilesMap = new Map(cachedProfiles.map((p) => [p.id, p]));
      const githubProfilesMap = new Map(githubChatbots.map((p) => [p.id, p]));

      const profilesToSave: (ChatbotProfile & { userId: string })[] = [];
      let profilesAdded = 0;
      let profilesUpdated = 0;

      // Always ensure default chatbot is included
      const hasDefaultInCache = cachedProfilesMap.has("default");
      const hasDefaultInGithub = githubProfilesMap.has("default");
      
      if (!hasDefaultInCache) {
        profilesAdded++;
        profilesToSave.push({
          ...DEFAULT_CHATBOT_PROFILE,
          userId,
          isCurrent: currentChatbotId === "default" || !currentChatbotId,
        });
      } else {
        // Update default chatbot's isCurrent status if needed
        const cachedDefault = cachedProfilesMap.get("default");
        const shouldBeCurrent = currentChatbotId === "default" || !currentChatbotId;
        if (cachedDefault && cachedDefault.isCurrent !== shouldBeCurrent) {
          profilesUpdated++;
          profilesToSave.push({
            ...DEFAULT_CHATBOT_PROFILE,
            userId,
            isCurrent: shouldBeCurrent,
          });
        }
      }

      // Process GitHub chatbots (excluding default)
      for (const githubProfile of githubChatbots) {
        if (githubProfile.id === "default") continue; // Skip default, already handled above
        
        const cachedProfile = cachedProfilesMap.get(githubProfile.id);
        const shouldBeCurrent = githubProfile.id === currentChatbotId;
        
        if (!cachedProfile) {
          profilesAdded++;
          profilesToSave.push({
            ...githubProfile,
            userId,
            isCurrent: shouldBeCurrent,
          });
        } else if (
          new Date(githubProfile.createdAt) > new Date(cachedProfile.createdAt) ||
          githubProfile.name !== cachedProfile.name ||
          githubProfile.description !== cachedProfile.description ||
          githubProfile.systemPrompt !== cachedProfile.systemPrompt ||
          cachedProfile.isCurrent !== shouldBeCurrent
        ) {
          // Update if content changed OR isCurrent status changed
          profilesUpdated++;
          profilesToSave.push({
            ...githubProfile,
            userId,
            isCurrent: shouldBeCurrent,
          });
        }
      }
      
      // Ensure only one chatbot is marked as current
      // Update all cached profiles that should NOT be current
      for (const cachedProfile of cachedProfiles) {
        if (cachedProfile.id === "default") continue; // Already handled above
        const shouldBeCurrent = cachedProfile.id === currentChatbotId;
        if (cachedProfile.isCurrent !== shouldBeCurrent) {
          // Need to update isCurrent status
          const githubProfile = githubProfilesMap.get(cachedProfile.id);
          if (githubProfile) {
            profilesUpdated++;
            profilesToSave.push({
              ...githubProfile,
              userId,
              isCurrent: shouldBeCurrent,
            });
          } else {
            // Profile exists in cache but not in GitHub - update isCurrent status
            profilesUpdated++;
            profilesToSave.push({
              ...cachedProfile,
              userId,
              isCurrent: shouldBeCurrent,
            });
          }
        }
      }

      // Find deleted profiles (but never delete default)
      let profilesDeleted = 0;
      for (const cachedProfile of cachedProfiles) {
        if (cachedProfile.id === "default") continue; // Never delete default
        if (!githubProfilesMap.has(cachedProfile.id)) {
          await cache.deleteChatbotProfile(cachedProfile.id);
          profilesDeleted++;
        }
      }

      // Save updated profiles
      if (profilesToSave.length > 0) {
        await cache.saveChatbotProfiles(profilesToSave);
      }
      
      // Ensure default is always in cache
      const finalProfiles = await cache.getAllChatbotProfiles(userId);
      if (!finalProfiles.some((p) => p.id === "default")) {
        await cache.saveChatbotProfile({
          ...DEFAULT_CHATBOT_PROFILE,
          userId,
          isCurrent: currentChatbotId === "default" || !currentChatbotId,
        });
      }
      
      // Final check: ensure only one chatbot is marked as current
      // Use the currentChatbotId from GitHub as the source of truth
      const allFinalProfiles = await cache.getAllChatbotProfiles(userId);
      const currentProfiles = allFinalProfiles.filter((p) => p.isCurrent);
      const expectedCurrentId = currentChatbotId || "default";
      
      // Only fix if there's a mismatch
      if (
        currentProfiles.length !== 1 || 
        currentProfiles[0].id !== expectedCurrentId ||
        allFinalProfiles.some((p) => p.id !== expectedCurrentId && p.isCurrent)
      ) {
        // Fix: update all profiles to have correct isCurrent status based on GitHub
        const fixedProfiles = allFinalProfiles.map((profile) => ({
          ...profile,
          userId,
          isCurrent: profile.id === expectedCurrentId,
        }));
        await cache.saveChatbotProfiles(fixedProfiles);
      }

      // Update sync metadata
      const now = new Date().toISOString();
      await cache.updateSyncMetadata({
        userId,
        lastSyncTime: now,
        lastJournalSyncTime: now,
        lastProfileSyncTime: now,
      });

      return {
        journalEntries: { added, updated, deleted },
        chatbotProfiles: {
          added: profilesAdded,
          updated: profilesUpdated,
          deleted: profilesDeleted,
        },
        success: true,
      };
    } catch (error) {
      console.error("Incremental sync error:", error);
      return {
        journalEntries: { added: 0, updated: 0, deleted: 0 },
        chatbotProfiles: { added: 0, updated: 0, deleted: 0 },
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Sync a single journal entry (after create/update)
   */
  async syncJournalEntry(
    userId: string,
    accessToken: string,
    date: string
  ): Promise<void> {
    try {
      // Fetch just this entry from GitHub
      const entries = await fetchJournalEntriesFromGitHub(accessToken, userId);
      const entry = entries.find((e) => e.date === date);
      
      if (entry) {
        await cache.saveJournalEntry({ ...entry, userId });
      }
    } catch (error) {
      console.error("Error syncing journal entry:", error);
    }
  }

  /**
   * Sync chatbot profiles (after create/update/delete)
   */
  async syncChatbotProfiles(userId: string, accessToken: string): Promise<void> {
    try {
      const chatbots = await getChatbotsFromGitHub(accessToken);
      const currentChatbotId = await getCurrentChatbotIdFromGitHub(accessToken);
      const expectedCurrentId = currentChatbotId || "default";

      // Always include default chatbot, then add GitHub chatbots (excluding default if it exists)
      const allChatbots: (ChatbotProfile & { userId: string })[] = [
        {
          ...DEFAULT_CHATBOT_PROFILE,
          userId,
          isCurrent: expectedCurrentId === "default",
        },
        ...chatbots
          .filter((profile) => profile.id !== "default")
          .map((profile) => ({
            ...profile,
            userId,
            isCurrent: profile.id === expectedCurrentId,
          })),
      ];

      await cache.saveChatbotProfiles(allChatbots);

      // Final validation: ensure only one is current
      const finalProfiles = await cache.getAllChatbotProfiles(userId);
      const currentCount = finalProfiles.filter((p) => p.isCurrent).length;
      if (currentCount !== 1) {
        const fixedProfiles = finalProfiles.map((profile) => ({
          ...profile,
          userId,
          isCurrent: profile.id === expectedCurrentId,
        }));
        await cache.saveChatbotProfiles(fixedProfiles);
      }

      const now = new Date().toISOString();
      const metadata = await cache.getSyncMetadata(userId);
      if (metadata) {
        await cache.updateSyncMetadata({
          ...metadata,
          lastProfileSyncTime: now,
          lastSyncTime: now,
        });
      }
    } catch (error) {
      console.error("Error syncing chatbot profiles:", error);
    }
  }
}

export const syncService = new SyncService();

