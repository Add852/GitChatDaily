"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ChatbotInterface } from "@/components/ChatbotInterface";
import { ChatbotInterfaceSkeleton } from "@/components/Skeleton";
import { ChatbotProfile, ConversationMessage, HighlightItem, JournalEntry } from "@/types";
import { DEFAULT_CHATBOT_PROFILE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

function JournalPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chatbotProfile, setChatbotProfile] = useState<ChatbotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationActive, setConversationActive] = useState(false);
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

  const fetchChatbotProfile = async () => {
    try {
      const response = await fetch("/api/chatbot-profiles");
      if (response.ok) {
        const chatbots = await response.json();
        if (Array.isArray(chatbots) && chatbots.length > 0) {
          const current =
            chatbots.find((c: ChatbotProfile) => c.isCurrent) ||
            chatbots[0] ||
            DEFAULT_CHATBOT_PROFILE;
          setChatbotProfile(current);
          return;
        }
      }
      // If response not ok or no chatbots
      if (!chatbotProfile) {
        setChatbotProfile(DEFAULT_CHATBOT_PROFILE);
      }
    } catch (error) {
      console.error("Error fetching chatbots:", error);
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

      // Don't auto-redirect - let user view the summary
      // If redirect is needed, go to entries page instead
      // router.push("/entries");
    } catch (error) {
      console.error("Error saving journal entry:", error);
      alert("Failed to save journal entry. Please try again.");
    }
  };

  if (!session) {
    if (status === "loading") {
      return (
        <div className="min-h-screen bg-github-dark">
          <Navbar />
          <div className="flex items-center justify-center h-screen">
            <div className="text-gray-400">Loading...</div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">New Journal Entry</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <p className="text-sm sm:text-base text-gray-400">
              Have a conversation with your AI companion about your day
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onClick={() => {
                  if (!conversationActive) {
                    router.push(`/entries/${selectedDate}`);
                  }
                }}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setSelectedDate(newDate);
                  router.push(`/journal?date=${newDate}`);
                }}
                className={`bg-github-dark-hover border border-github-dark-border rounded-lg px-2 sm:px-3 py-1 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-github-green ${
                  conversationActive ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              />
              <EntryStatus selectedDate={selectedDate} />
            </div>
          </div>
        </div>
        <div className="h-[calc(100vh-200px)] sm:h-[calc(100vh-180px)] min-h-[500px] sm:min-h-[700px] overflow-hidden">
          {loading || !chatbotProfile ? (
            <ChatbotInterfaceSkeleton />
          ) : (
            <ChatbotInterface
              key={`${chatbotProfile.id}-${selectedDate}`}
              chatbotProfile={chatbotProfile}
              onComplete={handleComplete}
              onConversationStart={() => setConversationActive(true)}
              onConversationEnd={() => setConversationActive(false)}
              onNavigateToEntries={() => router.push("/entries")}
              onNavigateToProfiles={() => router.push("/chatbots")}
              entryDate={selectedDate}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function JournalPageFallback() {
  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    </div>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<JournalPageFallback />}>
      <JournalPageContent />
    </Suspense>
  );
}

function EntryStatus({ selectedDate }: { selectedDate: string }) {
  const [status, setStatus] = useState<"checking" | "exists" | "none">("checking");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("checking");

    const checkEntry = async () => {
      try {
        const response = await fetch(`/api/journal?date=${selectedDate}`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (response.ok) {
          setStatus("exists");
        } else if (response.status === 404) {
          setStatus("none");
        } else {
          setStatus("none");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Entry status check failed:", error);
          setStatus("none");
        }
      }
    };

    void checkEntry();

    return () => {
      controller.abort();
    };
  }, [selectedDate]);

  let content = null;
  
  if (status === "checking") {
    content = <p className="text-sm text-gray-400">Checking for entries on this date…</p>;
  } else if (status === "exists") {
    content = (
      <p className="text-sm text-yellow-400 flex items-center gap-2">
        Entry already exists.
        <button
          onClick={() => window.location.assign(`/entries/${selectedDate}`)}
          className="text-xs text-github-green underline hover:text-github-green-hover"
        >
          View entry
        </button>
      </p>
    );
  } else if (status === "none") {
    content = <p className="text-sm text-green-400">No entry yet for this date.</p>;
  }

  return <div className="min-h-[20px]">{content}</div>;
}

