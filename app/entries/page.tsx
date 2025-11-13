"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { JournalEntry } from "@/types";
import { formatDate } from "@/lib/utils";
import { MOOD_OPTIONS } from "@/lib/constants";

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
    if (session) {
      fetchEntries();
    }
  }, [session]);

  const fetchEntries = async () => {
    try {
      const response = await fetch("/api/journal");
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (error) {
      console.error("Error fetching entries:", error);
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
                  <p className="text-gray-300 line-clamp-3">{entry.summary.substring(0, 200)}...</p>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

