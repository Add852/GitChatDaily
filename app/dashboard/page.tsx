"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { ContributionGraph } from "@/components/ContributionGraph";
import { ContributionGraphSkeleton, Skeleton } from "@/components/Skeleton";
import { JournalEntry } from "@/types";
import { Modal } from "@/components/Modal";
import { formatDate } from "@/lib/utils";
import { useCache } from "@/lib/cache/context";

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
  const { journalEntries, isLoading: cacheLoading, sync } = useCache();
  const [showStatsInfo, setShowStatsInfo] = useState(false);

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

  // Filter entries to last year and convert to Map
  const entries = useMemo(() => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const filteredEntries = journalEntries.filter((entry: JournalEntry) => {
      const entryDate = new Date(entry.date);
      return entryDate >= oneYearAgo;
    });
    
    const entriesMap = new Map<string, JournalEntry>();
    filteredEntries.forEach((entry: JournalEntry) => {
      entriesMap.set(entry.date, entry);
    });
    
    return entriesMap;
  }, [journalEntries]);

  const loading = cacheLoading;

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

  const entriesArray = Array.from(entries.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const mostRecentEntry = entriesArray[0];
  const streakCount = entriesArray.length;

  // Check if entry exists for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDateStr = formatDate(today);
  const hasEntryToday = entries.has(todayDateStr);

  // Calculate analytics
  const calculateStats = () => {
    if (entriesArray.length === 0) {
      return {
        averageMood: null,
        currentStreak: 0,
        moodTrend: null,
        bestMood: null,
        moodByDayOfWeek: {},
        dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      };
    }

    // Average mood (all entries)
    const totalMood = entriesArray.reduce((sum, entry) => sum + (entry.mood || 3), 0);
    const averageMood = Math.round((totalMood / entriesArray.length) * 10) / 10;

    // Current streak (consecutive days with entries)
    // Count backwards from today, only counting days that have entries
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Create a Set of entry dates for quick lookup
    const entryDatesSet = new Set(entriesArray.map(entry => entry.date));
    
    // Check consecutive days backwards from today
    for (let daysAgo = 0; daysAgo < entriesArray.length + 1; daysAgo++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - daysAgo);
      const checkDateStr = formatDate(checkDate);
      
      if (entryDatesSet.has(checkDateStr)) {
        currentStreak++;
      } else {
        // If we're checking today (daysAgo === 0) and there's no entry, streak is 0
        // Otherwise, we've found a gap, so break
        break;
      }
    }


    // Mood trend (compare last 7 entries vs previous 7 entries)
    let moodTrend: "improving" | "declining" | "stable" | null = null;
    if (entriesArray.length >= 14) {
      const recent7 = entriesArray.slice(0, 7);
      const previous7 = entriesArray.slice(7, 14);
      const recentAvg = recent7.reduce((sum, e) => sum + (e.mood || 3), 0) / 7;
      const previousAvg = previous7.reduce((sum, e) => sum + (e.mood || 3), 0) / 7;
      const diff = recentAvg - previousAvg;
      
      if (diff > 0.3) moodTrend = "improving";
      else if (diff < -0.3) moodTrend = "declining";
      else moodTrend = "stable";
    } else if (entriesArray.length >= 7) {
      // If less than 14 entries, compare first half vs second half
      const mid = Math.floor(entriesArray.length / 2);
      const recent = entriesArray.slice(0, mid);
      const previous = entriesArray.slice(mid);
      const recentAvg = recent.reduce((sum, e) => sum + (e.mood || 3), 0) / recent.length;
      const previousAvg = previous.reduce((sum, e) => sum + (e.mood || 3), 0) / previous.length;
      const diff = recentAvg - previousAvg;
      
      if (diff > 0.3) moodTrend = "improving";
      else if (diff < -0.3) moodTrend = "declining";
      else moodTrend = "stable";
    }

    // Best mood entry
    const bestMoodEntry = entriesArray.reduce((best, entry) => 
      (entry.mood || 0) > (best.mood || 0) ? entry : best
    );

    // Calculate mood by day of week
    const moodByDayOfWeek: { [key: number]: number[] } = {
      0: [], // Sunday
      1: [], // Monday
      2: [], // Tuesday
      3: [], // Wednesday
      4: [], // Thursday
      5: [], // Friday
      6: [], // Saturday
    };

    entriesArray.forEach((entry) => {
      const entryDate = new Date(entry.date);
      const dayOfWeek = entryDate.getDay();
      if (entry.mood) {
        moodByDayOfWeek[dayOfWeek].push(entry.mood);
      }
    });

    const averageMoodByDay: { [key: number]: number } = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    Object.keys(moodByDayOfWeek).forEach((day) => {
      const dayNum = parseInt(day);
      const moods = moodByDayOfWeek[dayNum];
      if (moods.length > 0) {
        averageMoodByDay[dayNum] = moods.reduce((sum, m) => sum + m, 0) / moods.length;
      }
    });

    return {
      averageMood,
      currentStreak,
      moodTrend,
      bestMood: bestMoodEntry.mood,
      moodByDayOfWeek: averageMoodByDay,
      dayNames,
    };
  };

  const stats = calculateStats();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 w-full">
        {/* Mobile-First: Welcome Section - Brief and Simple */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Image
              src="/icons/app-icon.svg"
              alt="GitChat Journal logo"
              width={40}
              height={40}
              className="w-10 h-10 sm:w-12 sm:h-12 lg:hidden flex-shrink-0"
            />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
              Welcome back, {session.user?.name || "developer"}!
            </h1>
          </div>
          <p className="text-base sm:text-lg text-gray-400 leading-relaxed">
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
            <div className="bg-github-dark-hover border border-github-dark-border rounded-lg p-5 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Latest Entry</h2>
              {loading ? (
                <div className="flex flex-row gap-3 sm:gap-6">
                  {/* Left side - Entry details skeleton */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Skeleton className="h-4 sm:h-5 lg:h-6 w-32" />
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  {/* Right side - Streak and status skeleton */}
                  <div className="flex flex-col items-center border-l border-github-dark-border pl-3 sm:pl-4 lg:pl-6 gap-1.5 sm:gap-2 flex-shrink-0">
                    <div className="text-center">
                      <Skeleton className="h-3 w-12 mx-auto mb-0.5" />
                      <Skeleton className="h-6 sm:h-7 lg:h-8 w-8" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ) : mostRecentEntry ? (
                <div className="flex flex-row gap-3 sm:gap-6">
                  {/* Left side - Entry details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 truncate">{mostRecentEntry.date}</p>
                    <p className="text-xs sm:text-sm text-gray-400 mb-2">
                    Mood {mostRecentEntry.mood}/5 • {mostRecentEntry.highlights.length} highlights
                  </p>
                  <button
                    onClick={() => router.push(`/entries/${mostRecentEntry.date}`)}
                      className="text-sm sm:text-base text-github-green hover:text-github-green-hover underline font-medium"
                  >
                    View entry →
                  </button>
                  </div>
                  {/* Right side - Streak and status */}
                  <div className="flex flex-col items-center border-l border-github-dark-border pl-4 sm:pl-5 lg:pl-6 gap-2 sm:gap-3 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-xs sm:text-sm text-gray-400 mb-1">Streak</div>
                      <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-github-green leading-none">
                        {stats.currentStreak > 0 ? `${stats.currentStreak}` : "0"}
                      </div>
                    </div>
                    <div className={`text-xs sm:text-sm font-semibold text-center whitespace-nowrap ${
                      hasEntryToday ? "text-green-400" : "text-yellow-400"
                    }`}>
                      {hasEntryToday ? "✅ Today" : "⏳ No Entry"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-row gap-3 sm:gap-6">
                  {/* Left side - No entries message */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-400">No entries yet—start your first chat!</p>
                  </div>
                  {/* Right side - Streak and status */}
                  <div className="flex flex-col items-center border-l border-github-dark-border pl-4 sm:pl-5 lg:pl-6 gap-2 sm:gap-3 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-xs sm:text-sm text-gray-400 mb-1">Streak</div>
                      <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-github-green leading-none">0</div>
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-yellow-400 text-center whitespace-nowrap">
                      ⏳ No Entry
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Impact Stats */}
            <div className="bg-github-dark-hover border border-github-dark-border rounded-lg p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-semibold">Impact Stats</h2>
                <button
                  onClick={() => setShowStatsInfo(true)}
                  className="p-1.5 hover:bg-github-dark rounded-lg transition-colors text-gray-400 hover:text-white"
                  aria-label="View stats information"
                  title="View stats information"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </div>
              <div className="space-y-4 text-sm sm:text-base">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total private commits</span>
                  {loading ? (
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-5 w-12" />
                      <span className="text-xs text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : (
                    <span className="font-semibold text-lg">{entries.size}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Average mood</span>
                  {loading ? (
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-5 w-12" />
                      <span className="text-xs text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : (
                    <span className="font-semibold text-lg">
                      {stats.averageMood !== null ? `${stats.averageMood}/5` : "—"}
                    </span>
                  )}
                </div>
                {loading ? (
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Mood trend</span>
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-5 w-20" />
                      <span className="text-xs text-gray-500 animate-pulse">...</span>
                    </div>
                  </div>
                ) : stats.moodTrend ? (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Mood trend</span>
                    <span className={`font-semibold text-lg flex items-center gap-1.5 ${
                      stats.moodTrend === "improving" ? "text-green-400" :
                      stats.moodTrend === "declining" ? "text-red-400" :
                      "text-gray-400"
                    }`}>
                      {stats.moodTrend === "improving" && "↗"}
                      {stats.moodTrend === "declining" && "↘"}
                      {stats.moodTrend === "stable" && "→"}
                      <span className="capitalize">{stats.moodTrend}</span>
                    </span>
                  </div>
                ) : null}
                
                {/* Mood Pattern Chart - Compact version */}
                {loading ? (
                  <div className="pt-2 border-t border-github-dark-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide">Mood by Day</span>
                    </div>
                    <div className="space-y-1.5">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName, index) => (
                        <div key={index} className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-3 w-8" />
                            <div className="flex-1 mx-2">
                              <Skeleton className="h-1.5 sm:h-2 w-full rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-8" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : Object.keys(stats.moodByDayOfWeek).length > 0 ? (
                  <div className="pt-2 border-t border-github-dark-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide">Mood by Day</span>
                    </div>
                    <div className="space-y-1.5">
                      {stats.dayNames.map((dayName, index) => {
                        const moodByDay = stats.moodByDayOfWeek as { [key: number]: number };
                        const avgMood = moodByDay[index];
                        
                        if (avgMood === undefined) return null;
                        
                        const moodPercentage = (avgMood / 5) * 100;
                        const barColor = avgMood >= 4 ? "bg-green-500" :
                                       avgMood >= 3 ? "bg-green-400" :
                                       avgMood >= 2 ? "bg-yellow-500" :
                                       "bg-red-500";
                        
                        return (
                          <div key={index} className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] sm:text-xs text-gray-400 font-medium w-8">{dayName}</span>
                              <div className="flex-1 mx-2">
                                <div className="w-full bg-github-dark rounded-full h-1.5 sm:h-2 overflow-hidden">
                                  <div
                                    className={`h-full ${barColor} transition-all duration-300`}
                                    style={{ width: `${moodPercentage}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-[10px] sm:text-xs text-gray-300 font-semibold w-8 text-right">
                                {avgMood.toFixed(1)}
                    </span>
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>
                ) : null}
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

      {/* Stats Info Modal */}
      <Modal
        isOpen={showStatsInfo}
        onClose={() => setShowStatsInfo(false)}
        title="Impact Stats Information"
        size="md"
      >
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2 text-github-green">Total Private Commits</h3>
            <p className="text-gray-300">
              Total number of journal entries you&apos;ve created. Each entry is saved as a private commit in your GitHub repository.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2 text-github-green">Average Mood</h3>
            <p className="text-gray-300">
              Average of all mood ratings (1-5 scale) across all your journal entries. Calculated from entries in the last year.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2 text-github-green">Mood Trend</h3>
            <p className="text-gray-300">
              Compares your recent entries to older ones:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-1 text-gray-400 mb-2">
              <li><strong className="text-green-400">Improving</strong>: Recent mood is significantly higher</li>
              <li><strong className="text-red-400">Declining</strong>: Recent mood is significantly lower</li>
              <li><strong className="text-gray-400">Stable</strong>: Mood remains consistent</li>
            </ul>
            <p className="text-gray-300">
              Requires at least 7 entries to calculate.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-github-green">Mood by Day of Week</h3>
            <p className="text-gray-300">
              Shows your average mood for each day of the week. This helps identify patterns in your weekly mood cycles. 
              The number in parentheses shows how many entries you have for that day.
            </p>
          </div>
          
          <div className="pt-2 border-t border-github-dark-border text-xs text-gray-400">
            <p><strong>Data Basis:</strong> All statistics are calculated from entries in the last 12 months.</p>
          </div>
        </div>
      </Modal>
      </main>
  );
}

