"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { ChatbotInterface } from "@/components/ChatbotInterface";
import { ChatbotProfile, ConversationMessage, JournalEntry } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

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

  const fetchChatbotProfiles = async () => {
    try {
      const response = await fetch("/api/chatbot-profiles");
      if (response.ok) {
        const profiles = await response.json();
        if (Array.isArray(profiles) && profiles.length > 0) {
          setChatbotProfiles(profiles);
          
          // Only set default profile on initial load
          if (!profilesLoadedRef.current) {
            profilesLoadedRef.current = true;
            // On first load, use the currently selected profile if it exists, otherwise use default
            const currentProfileId = chatbotProfile?.id;
            if (currentProfileId) {
              const currentProfile = profiles.find((p: ChatbotProfile) => p.id === currentProfileId);
              if (currentProfile) {
                setChatbotProfile(currentProfile);
              } else {
                // Current profile not found, use default
                const defaultProfile = profiles.find((p: ChatbotProfile) => p.isDefault) || profiles[0] || DEFAULT_CHATBOT_PROFILE;
                setChatbotProfile(defaultProfile);
              }
            } else {
              // No profile selected yet, use default
              const defaultProfile = profiles.find((p: ChatbotProfile) => p.isDefault) || profiles[0] || DEFAULT_CHATBOT_PROFILE;
              setChatbotProfile(defaultProfile);
            }
          } else {
            // On subsequent loads, preserve the current selection if it still exists
            if (chatbotProfile) {
              const currentProfile = profiles.find((p: ChatbotProfile) => p.id === chatbotProfile.id);
              if (currentProfile) {
                // Update the profile object in case it changed
                setChatbotProfile(currentProfile);
              } else {
                // Current profile was deleted, fallback to default
                const defaultProfile = profiles.find((p: ChatbotProfile) => p.isDefault) || profiles[0] || DEFAULT_CHATBOT_PROFILE;
                setChatbotProfile(defaultProfile);
              }
            }
          }
        } else {
          // No profiles found, use default
          setChatbotProfiles([DEFAULT_CHATBOT_PROFILE]);
          if (!chatbotProfile) {
            setChatbotProfile(DEFAULT_CHATBOT_PROFILE);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching chatbot profiles:", error);
      // Fallback to default on error
      setChatbotProfiles([DEFAULT_CHATBOT_PROFILE]);
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
    mood: number
  ) => {
    if (!session?.user?.githubId || !selectedDate) return;

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
      const githubResponse = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          summary,
          mood,
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
          {chatbotProfiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Chatbot Profile</label>
              <select
                value={chatbotProfile.id}
                onChange={(e) => {
                  if (conversationActive) {
                    alert("Cannot change profile during an active conversation. Please finish or refresh the page.");
                    return;
                  }
                  const selected = chatbotProfiles.find((p) => p.id === e.target.value);
                  if (selected) {
                    setChatbotProfile(selected);
                  }
                }}
                disabled={conversationActive}
                className="bg-github-dark-hover border border-github-dark-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-github-green disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {chatbotProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} {profile.isDefault ? "(Default)" : ""}
                  </option>
                ))}
              </select>
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

