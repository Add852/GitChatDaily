import { JournalEntry, ChatbotProfile, UserApiSettings } from "@/types";

const DB_NAME = "gitchat-journal";
const DB_VERSION = 1;

// Store names
const STORES = {
  JOURNAL_ENTRIES: "journalEntries",
  CHATBOT_PROFILES: "chatbotProfiles",
  USER_SETTINGS: "userSettings",
  SYNC_METADATA: "syncMetadata",
} as const;

interface SyncMetadata {
  userId: string;
  lastSyncTime: string;
  lastJournalSyncTime: string;
  lastProfileSyncTime: string;
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private isAvailable(): boolean {
    return typeof window !== "undefined" && "indexedDB" in window;
  }

  private async init(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error("IndexedDB is not available");
    }
    
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.openDatabase();

    return this.initPromise;
  }

  private openDatabase(deleteFirst = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (deleteFirst) {
        // Delete the database first, then open it fresh
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => {
          this.doOpenDatabase(resolve, reject);
        };
        deleteRequest.onerror = () => {
          // Even if delete fails, try to open anyway
          this.doOpenDatabase(resolve, reject);
        };
      } else {
        this.doOpenDatabase(resolve, reject, true);
      }
    });
  }

  private doOpenDatabase(
    resolve: () => void,
    reject: (error: unknown) => void,
    allowRetry = false
  ): void {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const error = request.error;
      // Check if it's a version error (stored version is higher than requested)
      if (allowRetry && error?.name === "VersionError") {
        console.warn("IndexedDB version mismatch, deleting and recreating database...");
        this.initPromise = this.openDatabase(true);
        this.initPromise.then(resolve).catch(reject);
      } else {
        reject(error);
      }
    };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Journal entries store
        if (!db.objectStoreNames.contains(STORES.JOURNAL_ENTRIES)) {
          const journalStore = db.createObjectStore(STORES.JOURNAL_ENTRIES, {
            keyPath: "id",
          });
          journalStore.createIndex("userId", "userId", { unique: false });
          journalStore.createIndex("date", "date", { unique: false });
          journalStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        // Chatbot profiles store
        if (!db.objectStoreNames.contains(STORES.CHATBOT_PROFILES)) {
          const profileStore = db.createObjectStore(STORES.CHATBOT_PROFILES, {
            keyPath: "id",
          });
          profileStore.createIndex("userId", "userId", { unique: false });
          profileStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        // User settings store
        if (!db.objectStoreNames.contains(STORES.USER_SETTINGS)) {
          db.createObjectStore(STORES.USER_SETTINGS, {
            keyPath: "userId",
          });
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
          db.createObjectStore(STORES.SYNC_METADATA, {
            keyPath: "userId",
          });
        }
      };
  }

  // Journal Entries
  async getJournalEntry(userId: string, date: string): Promise<JournalEntry | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.JOURNAL_ENTRIES], "readonly");
      const store = transaction.objectStore(STORES.JOURNAL_ENTRIES);
      const index = store.index("userId");
      const request = index.openCursor(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as JournalEntry;
          if (entry.date === date) {
            resolve(entry);
            return;
          }
          cursor.continue();
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAllJournalEntries(userId: string): Promise<JournalEntry[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.JOURNAL_ENTRIES], "readonly");
      const store = transaction.objectStore(STORES.JOURNAL_ENTRIES);
      const index = store.index("userId");
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const entries = request.result as JournalEntry[];
        resolve(entries.sort((a, b) => b.date.localeCompare(a.date)));
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveJournalEntry(entry: JournalEntry & { userId: string }): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.JOURNAL_ENTRIES], "readwrite");
      const store = transaction.objectStore(STORES.JOURNAL_ENTRIES);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveJournalEntries(entries: (JournalEntry & { userId: string })[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.JOURNAL_ENTRIES], "readwrite");
      const store = transaction.objectStore(STORES.JOURNAL_ENTRIES);

      let completed = 0;
      const total = entries.length;

      if (total === 0) {
        resolve();
        return;
      }

      entries.forEach((entry) => {
        const request = store.put(entry);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async deleteJournalEntry(userId: string, date: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.JOURNAL_ENTRIES], "readwrite");
      const store = transaction.objectStore(STORES.JOURNAL_ENTRIES);
      const index = store.index("userId");
      const request = index.openCursor(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as JournalEntry;
          if (entry.date === date) {
            cursor.delete();
            resolve();
            return;
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Chatbot Profiles
  async getChatbotProfile(profileId: string): Promise<ChatbotProfile | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHATBOT_PROFILES], "readonly");
      const store = transaction.objectStore(STORES.CHATBOT_PROFILES);
      const request = store.get(profileId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAllChatbotProfiles(userId: string): Promise<ChatbotProfile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHATBOT_PROFILES], "readonly");
      const store = transaction.objectStore(STORES.CHATBOT_PROFILES);
      const index = store.index("userId");
      const request = index.getAll(userId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveChatbotProfile(profile: ChatbotProfile & { userId: string }): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHATBOT_PROFILES], "readwrite");
      const store = transaction.objectStore(STORES.CHATBOT_PROFILES);
      const request = store.put(profile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveChatbotProfiles(profiles: (ChatbotProfile & { userId: string })[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHATBOT_PROFILES], "readwrite");
      const store = transaction.objectStore(STORES.CHATBOT_PROFILES);

      let completed = 0;
      const total = profiles.length;

      if (total === 0) {
        resolve();
        return;
      }

      profiles.forEach((profile) => {
        const request = store.put(profile);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async deleteChatbotProfile(profileId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHATBOT_PROFILES], "readwrite");
      const store = transaction.objectStore(STORES.CHATBOT_PROFILES);
      const request = store.delete(profileId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // User Settings
  async getUserSettings(userId: string): Promise<UserApiSettings | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.USER_SETTINGS], "readonly");
      const store = transaction.objectStore(STORES.USER_SETTINGS);
      const request = store.get(userId);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.settings : null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveUserSettings(userId: string, settings: UserApiSettings): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.USER_SETTINGS], "readwrite");
      const store = transaction.objectStore(STORES.USER_SETTINGS);
      const request = store.put({ userId, settings });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync Metadata
  async getSyncMetadata(userId: string): Promise<SyncMetadata | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SYNC_METADATA], "readonly");
      const store = transaction.objectStore(STORES.SYNC_METADATA);
      const request = store.get(userId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async updateSyncMetadata(metadata: SyncMetadata): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SYNC_METADATA], "readwrite");
      const store = transaction.objectStore(STORES.SYNC_METADATA);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data for a user (useful for logout)
  async clearUserData(userId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [STORES.JOURNAL_ENTRIES, STORES.CHATBOT_PROFILES, STORES.USER_SETTINGS, STORES.SYNC_METADATA],
        "readwrite"
      );

      let completed = 0;
      const total = 4;

      const checkComplete = () => {
        completed++;
        if (completed === total) resolve();
      };

      // Clear journal entries
      const journalStore = transaction.objectStore(STORES.JOURNAL_ENTRIES);
      const journalIndex = journalStore.index("userId");
      const journalRequest = journalIndex.openCursor(IDBKeyRange.only(userId));
      journalRequest.onsuccess = () => {
        const cursor = journalRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      journalRequest.onerror = () => reject(journalRequest.error);

      // Clear chatbot profiles
      const profileStore = transaction.objectStore(STORES.CHATBOT_PROFILES);
      const profileIndex = profileStore.index("userId");
      const profileRequest = profileIndex.openCursor(IDBKeyRange.only(userId));
      profileRequest.onsuccess = () => {
        const cursor = profileRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      profileRequest.onerror = () => reject(profileRequest.error);

      // Clear user settings
      const settingsStore = transaction.objectStore(STORES.USER_SETTINGS);
      const settingsRequest = settingsStore.delete(userId);
      settingsRequest.onsuccess = () => checkComplete();
      settingsRequest.onerror = () => reject(settingsRequest.error);

      // Clear sync metadata
      const metadataStore = transaction.objectStore(STORES.SYNC_METADATA);
      const metadataRequest = metadataStore.delete(userId);
      metadataRequest.onsuccess = () => checkComplete();
      metadataRequest.onerror = () => reject(metadataRequest.error);
    });
  }
}

export const cache = new IndexedDBCache();

