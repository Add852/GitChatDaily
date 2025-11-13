"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { JournalEntry } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MOOD_OPTIONS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

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
    try {
      const response = await fetch(`/api/journal?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setEntry(data);
        setEditedSummary(data.summary);
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.summary}</ReactMarkdown>
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
                  {message.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

