"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ContributionGraph } from "@/components/ContributionGraph";
import { JournalEntry } from "@/types";
import { cache, CACHE_KEYS } from "@/lib/cache";

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
    if (session?.user?.githubId) {
      const cacheKey = CACHE_KEYS.JOURNAL_ENTRIES(session.user.githubId);
      const cachedEntries = cache.get<JournalEntry[]>(cacheKey);
      
      if (cachedEntries) {
        const entriesMap = buildEntriesMap(cachedEntries);
        setEntries(entriesMap);
        setLoading(false);
        fetch("/api/journal/sync", { method: "POST" })
          .then(() => fetchEntries({ silent: true }))
          .catch((error) => {
            console.error("Error syncing entries:", error);
          });
      } else {
        fetch("/api/journal/sync", { method: "POST" })
          .then(() => fetchEntries())
          .catch((error) => {
            console.error("Error syncing entries:", error);
            fetchEntries();
          });
      }
    }
  }, [session]);

  const buildEntriesMap = (list: JournalEntry[]) => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const filteredEntries = list.filter((entry: JournalEntry) => {
      const entryDate = new Date(entry.date);
      return entryDate >= oneYearAgo;
    });
    const entriesMap = new Map<string, JournalEntry>();
    filteredEntries.forEach((entry: JournalEntry) => {
      entriesMap.set(entry.date, entry);
    });
    return entriesMap;
  };

  const fetchEntries = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!session?.user?.githubId) return;
    if (!silent) {
      setLoading(true);
    }
    
    try {
      const response = await fetch("/api/journal");
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const cacheKey = CACHE_KEYS.JOURNAL_ENTRIES(session.user.githubId);
          cache.set(cacheKey, data, 5 * 60 * 1000);
          setEntries(buildEntriesMap(data));
        } else if (entries.size === 0) {
          setEntries(new Map());
        }
      } else {
        console.error("Failed to fetch entries:", response.status, response.statusText);
        if (entries.size === 0) {
          setEntries(new Map());
        }
      }
    } catch (error) {
      console.error("Error fetching entries:", error);
      if (entries.size === 0) {
        setEntries(new Map());
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {session.user?.name}!</h1>
          <p className="text-gray-400">Track your daily journal entries and mood</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
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
            <div className="bg-github-dark border border-github-dark-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Stats</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Entries</span>
                  <span className="font-semibold">{entries.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Year</span>
                  <span className="font-semibold">{entries.size}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

