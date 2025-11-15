"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ContributionGraph } from "@/components/ContributionGraph";
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

  const entriesArray = Array.from(entries.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const mostRecentEntry = entriesArray[0];
  const streakCount = entriesArray.length;

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-github-dark-hover border border-github-dark-border rounded-2xl p-8 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-github-green font-semibold">
              Developer wellness platform
              </p>
              <h1 className="text-3xl font-bold mt-2">
                Welcome back, {session.user?.name || "developer"}! Keep shipping without burning out.
              </h1>
              <p className="text-gray-400 mt-2">
                Have a conversation, auto-generate a Markdown entry, and log a mental-health-friendly
                commit every time you reflect.
              </p>
            </div>
            <div className="bg-github-dark border border-github-dark-border rounded-xl p-4 min-w-[230px]">
              <p className="text-sm text-gray-400">Latest entry</p>
              {mostRecentEntry ? (
                <>
                  <p className="text-2xl font-semibold text-white mt-1">{mostRecentEntry.date}</p>
                  <p className="text-sm text-gray-500">
                    Mood {mostRecentEntry.mood}/5 • {mostRecentEntry.highlights.length} highlights
                  </p>
                </>
              ) : (
                <p className="text-white text-lg mt-1">No entries yet—start your first chat!</p>
              )}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {heroHighlights.map((point) => (
              <div
                key={point.title}
                className="border border-github-dark-border rounded-xl p-4 bg-github-dark"
              >
                <div className="text-2xl">{point.icon}</div>
                <h3 className="text-lg font-semibold mt-2">{point.title}</h3>
                <p className="text-sm text-gray-400 mt-1">{point.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Activity (Last 12 Months)</h2>
                <p className="text-sm text-gray-500">
                  Each glowing tile represents a conversation-driven entry committed to GitHub.
                </p>
              </div>
              <span className="text-sm text-gray-400">
                {streakCount} entries • {entries.size} synced days
              </span>
            </div>
            <ContributionGraph entries={entries} />
          </div>
          <div className="space-y-6">
            <div className="bg-github-dark border border-github-dark-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/journal")}
                  className="w-full px-4 py-3 bg-github-green hover:bg-github-green-hover text-white rounded-lg font-medium transition-colors"
                >
                  New Journal Entry
                </button>
                <button
                  onClick={() => router.push("/entries")}
                  className="w-full px-4 py-3 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg font-medium transition-colors border border-github-dark-border"
                >
                  View All Entries
                </button>
              </div>
            </div>
            <div className="bg-github-dark border border-github-dark-border rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold">Impact Stats</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total private commits</span>
                  <span className="font-semibold">{entries.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Most recent mood</span>
                  <span className="font-semibold">
                    {mostRecentEntry ? `${mostRecentEntry.mood}/5` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Highlights captured</span>
                  <span className="font-semibold">
                    {entriesArray.reduce(
                      (total, entry) => total + (entry.highlights?.length || 0),
                      0
                    )}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Be productive while protecting your mental health—keep the streak alive.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

