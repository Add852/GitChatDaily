"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EntryCardSkeleton } from "@/components/Skeleton";
import { JournalEntry } from "@/types";
import { formatDate } from "@/lib/utils";
import { MOOD_OPTIONS } from "@/lib/constants";
import { useCache } from "@/lib/cache/context";

export default function EntriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { journalEntries, isLoading: cacheLoading, sync } = useCache();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Sync in background when component mounts (if needed)
  useEffect(() => {
    if (session && !cacheLoading) {
      // Trigger incremental sync in background
      sync(true).catch(console.error);
    }
  }, [session, cacheLoading, sync]);

  const loading = cacheLoading;
  const entries = journalEntries;

  if (!session) {
    if (status === "loading") {
      return (
        <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading...</div>
        </div>
      );
    }
    return null;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">All Journal Entries</h1>
          <p className="text-sm sm:text-base text-gray-400">Browse and manage your journal entries</p>
        </div>
        <div className="space-y-3 sm:space-y-4">
          {loading ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <EntryCardSkeleton key={i} />
              ))}
            </>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-400">
              <p className="text-sm sm:text-base">No journal entries yet.</p>
              <button
                onClick={() => router.push("/journal")}
                className="mt-4 px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-sm sm:text-base"
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
                  className="bg-github-dark border border-github-dark-border rounded-lg p-4 sm:p-6 hover:border-github-green/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/entries/${entry.date}`)}
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-semibold">{entry.date}</h3>
                      <p className="text-xs sm:text-sm text-gray-400">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xl sm:text-2xl">{moodOption?.emoji}</span>
                      <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">
                        {moodOption?.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm sm:text-base text-gray-300 line-clamp-2 sm:line-clamp-3">{entry.summary.substring(0, 200)}...</p>
                </div>
              );
            })
          )}
        </div>
      </main>
  );
}

