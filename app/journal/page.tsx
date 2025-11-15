"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ChatbotInterface } from "@/components/ChatbotInterface";
import { ChatbotProfile, ConversationMessage, HighlightItem, JournalEntry } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default function JournalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chatbotProfile, setChatbotProfile] = useState<ChatbotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationActive, setConversationActive] = useState(false);
  const [existingEntry, setExistingEntry] = useState<JournalEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));

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
    if (session) {
      fetchChatbotProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.githubId]);

  useEffect(() => {
    if (session && selectedDate) {
      checkExistingEntry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.githubId, selectedDate]);

  const checkExistingEntry = async () => {
    if (!session?.user?.githubId || !selectedDate) return;
    try {
      // First sync entries from GitHub
      await fetch("/api/journal/sync", { method: "POST" });
      
      // Then check for existing entry
      const response = await fetch(`/api/journal?date=${selectedDate}`);
      if (response.ok) {
        const entry = await response.json();
        setExistingEntry(entry);
      } else {
        setExistingEntry(null);
      }
    } catch (error) {
      console.error("Error checking existing entry:", error);
      setExistingEntry(null);
    }
  };

  const fetchChatbotProfile = async () => {
    try {
      const response = await fetch("/api/chatbot-profiles");
      if (response.ok) {
        const profiles = await response.json();
        if (Array.isArray(profiles) && profiles.length > 0) {
          const current =
            profiles.find((p: ChatbotProfile) => p.isCurrent) ||
            profiles[0] ||
            DEFAULT_CHATBOT_PROFILE;
          setChatbotProfile(current);
          return;
        }
      }
      // If response not ok or no profiles
      if (!chatbotProfile) {
        setChatbotProfile(DEFAULT_CHATBOT_PROFILE);
      }
    } catch (error) {
      console.error("Error fetching chatbot profiles:", error);
      if (!chatbotProfile) {
        setChatbotProfile(DEFAULT_CHATBOT_PROFILE);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (
    conversation: ConversationMessage[],
    summary: string,
    highlights: HighlightItem[],
    mood: number
  ) => {
    if (!session?.user?.githubId || !selectedDate || !chatbotProfile) return;

    const entry: JournalEntry = {
      id: `${session.user.githubId}-${selectedDate}`,
      date: selectedDate,
      highlights,
      summary,
      conversation,
      mood,
      chatbotProfileId: chatbotProfile.id,
      chatbotProfileName: chatbotProfile.name,
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
      const githubResponse = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          summary,
          highlights,
          conversation,
          mood,
          chatbotProfileName: chatbotProfile.name,
        }),
      });

      if (!githubResponse.ok) {
        console.error("Failed to sync to GitHub, but entry saved locally");
      }

      // Update existing entry state
      setExistingEntry(entry);

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
        <div className="mb-6 flex items-center justify-between">
          <div>
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
                    setExistingEntry(null);
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
          {chatbotProfile && (
            <div className="text-right">
              <p className="text-sm text-gray-400">
                Current profile: <span className="text-white font-semibold">{chatbotProfile.name}</span>
              </p>
              <button
                type="button"
                className="text-xs text-github-green hover:text-github-green-hover underline mt-1"
                onClick={() => router.push("/profiles")}
              >
                Manage profiles
              </button>
            </div>
          )}
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

