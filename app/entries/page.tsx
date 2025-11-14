"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { JournalEntry } from "@/types";
import { MOOD_OPTIONS } from "@/lib/constants";
import { cache, CACHE_KEYS } from "@/lib/cache";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function EntriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
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
        setEntries(cachedEntries);
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

  const fetchEntries = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!session?.user?.githubId) return;
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/journal");
      if (response.ok) {
        const data = await response.json();
        const entriesArray = Array.isArray(data) ? data : [];
        setEntries(entriesArray);
        const cacheKey = CACHE_KEYS.JOURNAL_ENTRIES(session.user.githubId);
        cache.set(cacheKey, entriesArray, 5 * 60 * 1000);
      } else {
        console.error("Failed to fetch entries:", response.status, response.statusText);
        if (entries.length === 0) {
          setEntries([]);
        }
      }
    } catch (error) {
      console.error("Error fetching entries:", error);
      if (entries.length === 0) {
        setEntries([]);
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
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">All Journal Entries</h1>
          <p className="text-gray-400">Browse and manage your journal entries</p>
        </div>
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No journal entries yet.</p>
              <button
                onClick={() => router.push("/journal")}
                className="mt-4 px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg"
              >
                Create Your First Entry
              </button>
            </div>
          ) : (
            entries.map((entry) => {
              const moodOption = MOOD_OPTIONS.find((m) => m.value === entry.mood);
              return (
                <div
                  key={entry.id}
                  className="bg-github-dark border border-github-dark-border rounded-lg p-6 hover:border-github-green/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/entries/${entry.date}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-semibold">{entry.date}</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{moodOption?.emoji}</span>
                      <span className="text-sm text-gray-400">
                        {moodOption?.label}
                      </span>
                    </div>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none text-gray-300 line-clamp-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {entry.summary.replace(/^---[\s\S]*?---\s*/gm, "").trim()}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

