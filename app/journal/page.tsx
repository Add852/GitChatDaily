"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { ChatbotInterface, SummarySectionsPayload } from "@/components/ChatbotInterface";
import { ChatbotProfile, ConversationMessage, JournalEntry } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { cache, CACHE_KEYS } from "@/lib/cache";

const deriveSummarySections = (markdown: string): SummarySectionsPayload => {
  if (!markdown) {
    return {
      highlights: ["No highlights captured."],
      summary: "You reflected on your day and recorded your thoughts.",
    };
  }

  const highlightsMatch = markdown.match(/### Highlights([\s\S]*?)(### Summary|$)/i);
  const summaryMatch = markdown.match(/### Summary([\s\S]*)/i);

  const highlightsRaw = highlightsMatch?.[1] ?? "";
  const summaryRaw = summaryMatch?.[1]?.trim() ?? markdown.trim();

  const highlights = highlightsRaw
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  return {
    highlights: highlights.length > 0 ? highlights : ["No specific highlights were provided."],
    summary: summaryRaw.length > 0 ? summaryRaw : markdown.trim(),
  };
};

export default function JournalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chatbotProfile, setChatbotProfile] = useState<ChatbotProfile | null>(null);
  const [chatbotProfiles, setChatbotProfiles] = useState<ChatbotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationActive, setConversationActive] = useState(false);
  const [existingEntry, setExistingEntry] = useState<JournalEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const profilesLoadedRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    // Get date from URL parameter, default to today
    const dateParam = searchParams.get("date");
    if (dateParam) {
      setSelectedDate(dateParam);
    } else {
      setSelectedDate(formatDate(new Date()));
    }
  }, [searchParams]);

  useEffect(() => {
    if (session && selectedDate) {
      fetchChatbotProfiles();
      checkExistingEntry();
    }
    // Only fetch once when session is available, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.githubId, selectedDate]);

  const checkExistingEntry = async () => {
    if (!session?.user?.githubId || !selectedDate || !chatbotProfile) return;
    try {
      // Check cache first
      const cacheKey = CACHE_KEYS.JOURNAL_ENTRY(session.user.githubId, selectedDate);
      const cachedEntry = cache.get<JournalEntry>(cacheKey);
      
      if (cachedEntry) {
        setExistingEntry(cachedEntry);
        // Still sync in background
        fetch("/api/journal/sync", { method: "POST" }).catch(() => {});
        return;
      }
      
      // First sync entries from GitHub
      await fetch("/api/journal/sync", { method: "POST" });
      
      // Then check for existing entry
      const response = await fetch(`/api/journal?date=${selectedDate}`);
      if (response.ok) {
        const entry = await response.json();
        // Only set existing entry if we actually got a valid entry object
        if (entry && entry.id && entry.date) {
          setExistingEntry(entry);
          // Cache the entry
          cache.set(cacheKey, entry, 5 * 60 * 1000);
        } else {
          setExistingEntry(null);
        }
      } else if (response.status === 404) {
        // Entry doesn't exist
        setExistingEntry(null);
      } else {
        // Other error, don't show warning
        setExistingEntry(null);
      }
    } catch (error) {
      console.error("Error checking existing entry:", error);
      setExistingEntry(null);
    }
  };

  const applyProfilesResponse = (data?: { profiles?: ChatbotProfile[]; currentProfileId?: string | null }) => {
    const list =
      Array.isArray(data?.profiles) && data.profiles.length > 0
        ? data.profiles
        : [DEFAULT_CHATBOT_PROFILE];

    setChatbotProfiles(list);

    const desiredProfileId = data?.currentProfileId ?? chatbotProfile?.id;
    const resolvedProfile =
      list.find((profile) => profile.id === desiredProfileId) ||
      list[0];

    profilesLoadedRef.current = true;
    setChatbotProfile(resolvedProfile);
  };

  const fetchChatbotProfiles = async () => {
    if (!session?.user?.githubId) return;

    const cacheKey = CACHE_KEYS.CHATBOT_PROFILES(session.user.githubId);
    const cachedResponse = cache.get<{ profiles: ChatbotProfile[]; currentProfileId?: string }>(cacheKey);

    if (cachedResponse?.profiles?.length) {
      applyProfilesResponse(cachedResponse);
    }

    try {
      const response = await fetch("/api/chatbot-profiles");
      if (response.ok) {
        const data = await response.json();
        cache.set(cacheKey, data, 5 * 60 * 1000);
        applyProfilesResponse(data);
      } else if (!cachedResponse) {
        applyProfilesResponse({ profiles: [DEFAULT_CHATBOT_PROFILE], currentProfileId: "default" });
      }
    } catch (error) {
      console.error("Error fetching chatbot profiles:", error);
      if (!cachedResponse) {
        applyProfilesResponse({ profiles: [DEFAULT_CHATBOT_PROFILE], currentProfileId: "default" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (
    conversation: ConversationMessage[],
    summary: string,
    mood: number,
    summarySections?: SummarySectionsPayload
  ) => {
    if (!session?.user?.githubId || !selectedDate || !chatbotProfile) {
      console.error("Missing session, date, or chatbot profile. Cannot save entry.");
      return;
    }

    const entry: JournalEntry = {
      id: `${session.user.githubId}-${selectedDate}`,
      date: selectedDate,
      summary,
      conversation,
      mood,
      chatbotProfileId: chatbotProfile.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Save to local storage/API
      const saveResponse = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save journal entry");
      }

      // Sync to GitHub
      const sectionsPayload =
        summarySections && summarySections.summary
          ? summarySections
          : deriveSummarySections(summary);

      const githubResponse = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          summary,
          mood,
          conversation,
          chatbotProfileName: chatbotProfile.name,
          summarySections: sectionsPayload,
        }),
      });

      if (!githubResponse.ok) {
        console.error("Failed to sync to GitHub, but entry saved locally");
      }

      // Update existing entry state
      setExistingEntry(entry);
      
      // Invalidate cache for entries list and this specific entry
      if (session?.user?.githubId) {
        cache.invalidatePattern(`journal:entries:${session.user.githubId}`);
        cache.delete(CACHE_KEYS.JOURNAL_ENTRY(session.user.githubId, selectedDate));
      }

      // Don't auto-redirect - let user view the summary
      // If redirect is needed, go to entries page instead
      // router.push("/entries");
    } catch (error) {
      console.error("Error saving journal entry:", error);
      alert("Failed to save journal entry. Please try again.");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-github-dark">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">New Journal Entry</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-gray-400">
                Have a conversation with your AI companion about your day
              </p>
              <span className="text-sm text-gray-500">•</span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setSelectedDate(newDate);
                    router.push(`/journal?date=${newDate}`);
                  }}
                  className="bg-github-dark-hover border border-github-dark-border rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-github-green"
                  disabled={conversationActive}
                />
              </div>
            </div>
            {existingEntry && (
              <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <p className="text-sm text-yellow-400">
                  ⚠️ An entry already exists for {selectedDate}.{" "}
                  <button
                    onClick={() => router.push(`/entries/${selectedDate}`)}
                    className="underline hover:text-yellow-300 transition-colors"
                  >
                    View existing entry
                  </button>
                  {" "}Creating a new entry will overwrite the existing one.
                </p>
              </div>
            )}
          </div>
          <div className="w-full lg:w-96 bg-github-dark border border-github-dark-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-gray-400">Current Profile</p>
                <h2 className="text-lg font-semibold">{chatbotProfile?.name ?? "Loading..."}</h2>
              </div>
              <button
                onClick={() => router.push("/profiles")}
                className="text-sm px-3 py-1 border border-github-dark-border rounded-lg hover:border-github-green transition-colors"
              >
                Manage
              </button>
            </div>
            <p className="text-sm text-gray-300">{chatbotProfile?.description}</p>
          </div>
        </div>
        <div className="h-[calc(100vh-180px)] min-h-[700px]">
          {chatbotProfile && (
            <ChatbotInterface
              key={`${chatbotProfile.id}-${selectedDate}`}
              chatbotProfile={chatbotProfile}
              onComplete={handleComplete}
              onConversationStart={() => setConversationActive(true)}
              onConversationEnd={() => setConversationActive(false)}
              onNavigateToEntries={() => router.push("/entries")}
              entryDate={selectedDate}
            />
          )}
        </div>
      </main>
    </div>
  );
}

