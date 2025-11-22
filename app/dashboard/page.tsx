"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ContributionGraph } from "@/components/ContributionGraph";
import { ContributionGraphSkeleton, Skeleton } from "@/components/Skeleton";
import { JournalEntry } from "@/types";

const heroHighlights = [
  {
    icon: "💬",
    title: "Conversational journaling",
    description: "Chat through highlights, blockers, and gratitude—your AI editor handles the prose.",
  },
  {
    icon: "🌙",
    title: "Nightly wind-down",
    description: "Pair mindful reflection with a consistent GitHub cadence before ending the day.",
  },
  {
    icon: "🔒",
    title: "Your commits, your story",
    description: "Entries live in a private repo—every reflection becomes a GitHub commit.",
  },
];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<Map<string, JournalEntry>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      // Sync entries from GitHub first
      fetch("/api/journal/sync", { method: "POST" })
        .then(() => fetchEntries())
        .catch((error) => {
          console.error("Error syncing entries:", error);
          fetchEntries(); // Still try to fetch local entries
        });
    }
  }, [session]);

  const fetchEntries = async () => {
    try {
      // Fetch all entries (we'll filter to last year in the component)
      const response = await fetch("/api/journal");
      if (response.ok) {
        const data = await response.json();
        // Ensure data is an array
        if (Array.isArray(data)) {
          // Filter to last year and convert to Map
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const filteredEntries = data.filter((entry: JournalEntry) => {
            const entryDate = new Date(entry.date);
            return entryDate >= oneYearAgo;
          });
          const entriesMap = new Map<string, JournalEntry>();
          filteredEntries.forEach((entry: JournalEntry) => {
            entriesMap.set(entry.date, entry);
          });
          setEntries(entriesMap);
        } else {
          setEntries(new Map());
        }
      } else {
        console.error("Failed to fetch entries:", response.status, response.statusText);
        setEntries(new Map());
      }
    } catch (error) {
      console.error("Error fetching entries:", error);
      setEntries(new Map());
    } finally {
      setLoading(false);
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

  const entriesArray = Array.from(entries.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const mostRecentEntry = entriesArray[0];
  const streakCount = entriesArray.length;

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Mobile-First: Welcome Section - Brief and Simple */}
        <section className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src="/icons/app-icon.svg"
              alt="GitChat Journal logo"
              className="w-8 h-8 sm:w-10 sm:h-10 lg:hidden flex-shrink-0"
            />
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
              Welcome back, {session.user?.name || "developer"}!
            </h1>
          </div>
          <p className="text-sm sm:text-base text-gray-400">
            Have a conversation, auto-generate a Markdown entry, and log a mental-health-friendly commit.
          </p>
        </section>

        {/* Activity Graph and Stats Section - Side by side on larger screens */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Activity Graph - Takes 2 columns on xl screens */}
          <div className="xl:col-span-2 space-y-3 sm:space-y-4">
            {loading ? (
              <ContributionGraphSkeleton />
            ) : (
              <ContributionGraph entries={entries} entriesCount={streakCount} syncedDaysCount={entries.size} />
            )}
          </div>

          {/* Latest Entry and Impact Stats - Takes 1 column on xl screens */}
          <div className="xl:col-span-1 space-y-4 sm:space-y-6">
            {/* Latest Entry */}
            <div className="bg-github-dark-hover border border-github-dark-border rounded-lg p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold mb-3">Latest Entry</h2>
              {loading ? (
                <div className="space-y-2.5">
                  <div className="flex items-baseline gap-2">
                    <Skeleton className="h-7 sm:h-8 w-32" />
                    <span className="text-xs text-gray-500 animate-pulse">Loading...</span>
                  </div>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : mostRecentEntry ? (
                <div className="space-y-2">
                  <p className="text-xl sm:text-2xl font-semibold text-white">{mostRecentEntry.date}</p>
                  <p className="text-xs sm:text-sm text-gray-400">
                    Mood {mostRecentEntry.mood}/5 • {mostRecentEntry.highlights.length} highlights
                  </p>
                  <button
                    onClick={() => router.push(`/entries/${mostRecentEntry.date}`)}
                    className="text-xs sm:text-sm text-github-green hover:text-github-green-hover underline mt-2"
                  >
                    View entry →
                  </button>
                </div>
              ) : (
                <p className="text-sm sm:text-base text-gray-400">No entries yet—start your first chat!</p>
              )}
            </div>

            {/* Impact Stats */}
            <div className="bg-github-dark-hover border border-github-dark-border rounded-lg p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold mb-3">Impact Stats</h2>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total private commits</span>
                  {loading ? (
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-4 w-10" />
                      <span className="text-[10px] text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : (
                    <span className="font-semibold">{entries.size}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Most recent mood</span>
                  {loading ? (
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-4 w-10" />
                      <span className="text-[10px] text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : (
                    <span className="font-semibold">
                      {mostRecentEntry ? `${mostRecentEntry.mood}/5` : "—"}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Highlights captured</span>
                  {loading ? (
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-4 w-12" />
                      <span className="text-[10px] text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : (
                    <span className="font-semibold">
                      {entriesArray.reduce(
                        (total, entry) => total + (entry.highlights?.length || 0),
                        0
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Additional Information - Hero Highlights (Compact on mobile, expanded on desktop) */}
        <section className="bg-github-dark-hover border border-github-dark-border rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8">
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-github-green font-semibold mb-3 sm:mb-4">
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {heroHighlights.map((point) => (
              <div
                key={point.title}
                className="border border-github-dark-border rounded-lg p-3 sm:p-4 bg-github-dark"
              >
                <div className="text-xl sm:text-2xl">{point.icon}</div>
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold mt-2">{point.title}</h3>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">{point.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

