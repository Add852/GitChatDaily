"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { CardSkeleton } from "@/components/Skeleton";
import { JournalEntry, HighlightItem } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MOOD_OPTIONS } from "@/lib/constants";

export default function EntryDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const date = params.date as string;
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedHighlights, setEditedHighlights] = useState<HighlightItem[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

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
        setEditedHighlights(
          (data.highlights && data.highlights.length > 0
            ? data.highlights
            : [
                {
                  title: "Highlight 1",
                  description: "",
                },
              ]) as HighlightItem[]
        );
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

    const sanitizedHighlights = editedHighlights
      .map((item) => ({
        title: item.title?.trim() || "Highlight",
        description: item.description?.trim() || "",
      }))
      .filter((item) => item.description.length > 0);

    const fallbackHighlights =
      sanitizedHighlights.length > 0
        ? sanitizedHighlights
        : [
            {
              title: "Daily Reflection",
              description: "Highlights unavailable. Please update later.",
            },
          ];

    const updatedEntry = {
      ...entry,
      highlights: fallbackHighlights,
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
            highlights: entry.highlights,
            mood: entry.mood,
            conversation: entry.conversation,
            chatbotProfileName: entry.chatbotProfileName,
          }),
        });
        setEntry(updatedEntry);
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error saving entry:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  const handleRedo = () => {
    router.push(`/journal?date=${date}`);
  };

  const handleHighlightChange = (index: number, field: "title" | "description", value: string) => {
    setEditedHighlights((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddHighlight = () => {
    setEditedHighlights((prev) => [
      ...prev,
      { title: `Highlight ${prev.length + 1}`, description: "" },
    ]);
  };

  const handleRemoveHighlight = (index: number) => {
    setEditedHighlights((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleDelete = async () => {
    if (!entry || isDeleting) return;
    const confirmed = confirm(
      `Delete the journal entry for ${entry.date}? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/journal?date=${entry.date}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete entry");
      }
      router.push("/entries");
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert("Failed to delete entry. Please try again.");
    } finally {
      setIsDeleting(false);
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

  const moodOption = entry ? MOOD_OPTIONS.find((m) => m.value === entry.mood) : null;

  return (
    <div className="min-h-screen bg-github-dark">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4">
          <button
            onClick={() => router.push("/entries")}
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span className="text-base sm:text-lg">←</span> Back to entries
          </button>
        </div>
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {loading || !entry ? (
            <>
              <div>
                <div className="h-8 sm:h-9 w-48 bg-github-dark-hover rounded animate-pulse mb-2" />
                <div className="h-5 w-32 bg-github-dark-hover rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-github-dark-hover rounded animate-pulse" />
                <div className="h-5 w-24 bg-github-dark-hover rounded animate-pulse" />
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Journal Entry</h1>
                <p className="text-sm sm:text-base text-gray-400">{entry.date}</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl">{moodOption?.emoji}</span>
                <span className="text-base sm:text-lg">{moodOption?.label}</span>
              </div>
            </>
          )}
        </div>

        {loading || !entry ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
        <div className="bg-github-dark border border-github-dark-border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h2 className="text-lg sm:text-xl font-semibold">Summary</h2>
            <div className="flex flex-wrap gap-2">
              {!isEditing && (
                <>
                  {session?.user && (
                    <a
                      href={`https://github.com/${(session.user as any)?.username || session.user?.name}/gitchat-journal/blob/main/entries/${date}.md`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-xs sm:text-sm transition-colors border border-github-dark-border flex items-center gap-1.5 sm:gap-2"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
                      </svg>
                      <span className="hidden sm:inline">View in GitHub</span>
                      <span className="sm:hidden">GitHub</span>
                    </a>
                  )}
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs sm:text-sm transition-colors border border-red-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-xs sm:text-sm transition-colors border border-github-dark-border"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleRedo}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-xs sm:text-sm transition-colors"
                  >
                    Redo
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-1">
              <h3 className="text-base sm:text-lg font-semibold">Highlights</h3>
              {isEditing && (
                <span className="text-xs text-gray-500">
                  Edit highlights to better reflect your own words.
                </span>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3 sm:space-y-4">
                {editedHighlights.map((highlight, index) => (
                  <div
                    key={`highlight-${index}`}
                    className="bg-github-dark-hover border border-github-dark-border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-300">Highlight {index + 1}</h4>
                      {editedHighlights.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveHighlight(index)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={highlight.title}
                      onChange={(e) => handleHighlightChange(index, "title", e.target.value)}
                      className="w-full bg-github-dark border border-github-dark-border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-github-green"
                      placeholder="Title"
                    />
                    <textarea
                      value={highlight.description}
                      onChange={(e) => handleHighlightChange(index, "description", e.target.value)}
                      className="w-full bg-github-dark border border-github-dark-border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-github-green resize-none h-20"
                      placeholder="Description"
                    />
                  </div>
                ))}
                {editedHighlights.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="px-3 sm:px-4 py-2 border border-dashed border-github-dark-border text-xs sm:text-sm text-gray-300 rounded-lg hover:border-github-green hover:text-white transition-colors"
                  >
                    + Add highlight
                  </button>
                )}
              </div>
            ) : entry.highlights && entry.highlights.length > 0 ? (
              <ul className="list-disc space-y-2 pl-4 sm:pl-5 text-gray-200 text-xs sm:text-sm">
                {entry.highlights.map((highlight, index) => (
                  <li key={`${highlight.title}-${index}`}>
                    <span className="font-semibold">{highlight.title}:</span>{" "}
                    <span className="text-gray-300">{highlight.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs sm:text-sm text-gray-400">No highlights recorded for this entry.</p>
            )}
          </div>
          {isEditing ? (
            <div>
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="w-full h-48 sm:h-64 bg-github-dark-hover border border-github-dark-border rounded-lg p-3 sm:p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-github-green resize-none font-mono text-xs sm:text-sm"
              />
              <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
                <button
                  onClick={handleSave}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-github-green hover:bg-github-green-hover text-white rounded-lg text-xs sm:text-sm transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedSummary(entry.summary);
                    setEditedHighlights(entry.highlights);
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-github-dark-hover hover:bg-github-dark-border text-white rounded-lg text-xs sm:text-sm transition-colors border border-github-dark-border"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm sm:prose-lg max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.summary}</ReactMarkdown>
            </div>
          )}
        </div>
        )}

        {!loading && entry && (
        <div className="bg-github-dark border border-github-dark-border rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Conversation</h2>
          <div className="space-y-3 sm:space-y-4">
            {entry.conversation.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-2.5 sm:p-3 ${
                    message.role === "user"
                      ? "bg-github-green text-white"
                      : "bg-github-dark-hover text-gray-200"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-invert prose-xs sm:prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-xs sm:text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </main>
    </div>
  );
}

