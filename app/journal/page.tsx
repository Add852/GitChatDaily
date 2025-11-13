"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { ChatbotInterface } from "@/components/ChatbotInterface";
import { ChatbotProfile, ConversationMessage, JournalEntry } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default function JournalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chatbotProfile, setChatbotProfile] = useState<ChatbotProfile | null>(null);
  const [chatbotProfiles, setChatbotProfiles] = useState<ChatbotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationActive, setConversationActive] = useState(false);
  const profilesLoadedRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchChatbotProfiles();
    }
    // Only fetch once when session is available, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.githubId]);

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
    if (!session?.user?.githubId) return;

    const today = formatDate(new Date());
    const entry: JournalEntry = {
      id: `${session.user.githubId}-${today}`,
      date: today,
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
          date: today,
          summary,
          mood,
        }),
      });

      if (!githubResponse.ok) {
        console.error("Failed to sync to GitHub, but entry saved locally");
      }

      // Redirect to entry view
      router.push(`/entries/${today}`);
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
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">New Journal Entry</h1>
            <p className="text-gray-400">
              Have a conversation with your AI companion about your day
            </p>
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
        <div className="h-[calc(100vh-250px)]">
          {chatbotProfile && (
            <ChatbotInterface
              key={chatbotProfile.id}
              chatbotProfile={chatbotProfile}
              onComplete={handleComplete}
              onConversationStart={() => setConversationActive(true)}
              onConversationEnd={() => setConversationActive(false)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

