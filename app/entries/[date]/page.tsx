"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { JournalEntry } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MOOD_OPTIONS } from "@/lib/constants";
import { cache, CACHE_KEYS } from "@/lib/cache";

export default function EntryDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const date = params.date as string;
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && date) {
      fetchEntry();
    }
  }, [session, date]);

  const fetchEntry = async () => {
    if (!session?.user?.githubId || !date) return;
    
    try {
      // Check cache first
      const cacheKey = CACHE_KEYS.JOURNAL_ENTRY(session.user.githubId, date);
      const cachedEntry = cache.get<JournalEntry>(cacheKey);
      
      if (cachedEntry) {
        setEntry(cachedEntry);
        setEditedSummary(cachedEntry.summary);
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/journal?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setEntry(data);
        setEditedSummary(data.summary);
        // Cache the entry
        cache.set(cacheKey, data, 5 * 60 * 1000);
      } else if (response.status === 404) {
        // Entry doesn't exist, redirect to create new entry
        router.push("/journal");
      }
    } catch (error) {
      console.error("Error fetching entry:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!entry) return;

    const updatedEntry = {
      ...entry,
      summary: editedSummary,
      updatedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEntry),
      });

      if (response.ok) {
        setEntry(updatedEntry);
        setIsEditing(false);
        
        // Update cache
        if (session?.user?.githubId) {
          const cacheKey = CACHE_KEYS.JOURNAL_ENTRY(session.user.githubId, entry.date);
          cache.set(cacheKey, updatedEntry, 5 * 60 * 1000);
          // Invalidate entries list cache
          cache.invalidatePattern(`journal:entries:${session.user.githubId}`);
        }

        // Update GitHub commit
        await fetch("/api/github/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: entry.date,
            summary: editedSummary,
            mood: entry.mood,
          }),
        });
      }
    } catch (error) {
      console.error("Error saving entry:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  const handleRedo = () => {
    router.push(`/journal?date=${date}`);
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

  if (!session || !entry) {
    return null;
  }

  const moodOption = MOOD_OPTIONS.find((m) => m.value === entry.mood);

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Journal Entry</h1>
            <p className="text-gray-400">{entry.date}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{moodOption?.emoji}</span>
            <span className="text-lg">{moodOption?.label}</span>
          </div>
        </div>

        <div className="bg-github-dark border border-github-dark-border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Summary</h2>
            <div className="flex gap-2">
              {!isEditing && (
                <>
                  {session?.user && (
                    <a
                      href={`https://github.com/${(session.user as any)?.username || session.user?.name}/gitchat-journal/blob/main/entries/${date}.md`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-sm transition-colors border border-github-dark-border flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
                      </svg>
                      View in GitHub
                    </a>
                  )}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-sm transition-colors border border-github-dark-border"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleRedo}
                    className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-sm transition-colors"
                  >
                    Redo Conversation
                  </button>
                </>
              )}
            </div>
          </div>
          {isEditing ? (
            <div>
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="w-full h-64 bg-github-dark-hover border border-github-dark-border rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-github-green resize-none font-mono text-sm"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-sm transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedSummary(entry.summary);
                  }}
                  className="px-4 py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-sm transition-colors border border-github-dark-border"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-lg max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {entry.summary.replace(/^---[\s\S]*?---\s*/gm, "").trim()}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="bg-github-dark border border-github-dark-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Conversation</h2>
          <div className="space-y-4">
            {entry.conversation.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-github-green text-white"
                      : "bg-github-dark-hover text-gray-200"
                  }`}
                >
                  <div className="prose prose-invert prose-sm max-w-none [&_*]:text-inherit">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

