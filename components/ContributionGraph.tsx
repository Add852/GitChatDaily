"use client";

import { useEffect, useState } from "react";
import { JournalEntry } from "@/types";
import { CONTRIBUTION_GRAPH_COLORS } from "@/lib/constants";
import { getDaysInYear, getWeekday, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ContributionGraphProps {
  entries: Map<string, JournalEntry>;
  year?: number;
  entriesCount?: number;
  syncedDaysCount?: number;
}

export function ContributionGraph({ entries, year = new Date().getFullYear(), entriesCount, syncedDaysCount }: ContributionGraphProps) {
  const router = useRouter();
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [visibleWeeks, setVisibleWeeks] = useState<number>(52); // Default to full year
  
  // Calculate how many weeks can fit based on screen width - smooth gradual scaling
  useEffect(() => {
    const calculateVisibleWeeks = () => {
      const screenWidth = window.innerWidth;
      
      // Calculate tile width based on screen size (smooth transition)
      // Mobile (< 640px): w-2.5 (10px) + gap-1 (2px) = 12px per week
      // Tablet/Desktop (>= 640px): w-3 (12px) + gap-1 (4px) = 16px per week
      const tileWidth = screenWidth < 640 ? 12 : 16;
      
      // Account for padding: container padding (p-4 = 16px, p-6 = 24px) + page padding
      // Smooth transition between breakpoints
      let containerPadding, pagePadding;
      if (screenWidth < 640) {
        containerPadding = 32; // p-4 = 16px each side
        pagePadding = 32; // px-4 = 16px each side
      } else if (screenWidth < 1024) {
        containerPadding = 48; // p-6 = 24px each side
        pagePadding = 48; // px-6 = 24px each side
      } else {
        containerPadding = 48; // p-6 = 24px each side
        pagePadding = 48; // px-6 = 24px each side
      }
      
      const totalPadding = containerPadding + pagePadding;
      const availableWidth = screenWidth - totalPadding;
      const weeksThatFit = Math.floor(availableWidth / tileWidth);
      
      // Smooth continuous scaling - no hard jumps
      // Minimum: Always show at least 12 weeks (3 months) for usability
      // Maximum: Show all 52 weeks if there's space, otherwise show what fits
      // Subtract 1-2 weeks as buffer to prevent overflow
      const visibleWeeks = Math.max(12, Math.min(weeksThatFit - 1, 52));
      
      setVisibleWeeks(visibleWeeks);
    };

    calculateVisibleWeeks();
    const handleResize = () => calculateVisibleWeeks();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Get days from 1 year ago to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  
  const days: Date[] = [];
  for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  
  const weeks: Date[][] = [];
  
  // Group days into weeks (Sunday = 0, Monday = 1, etc.)
  let currentWeek: Date[] = [];
  const firstDay = days[0];
  const firstWeekday = getWeekday(firstDay);
  
  // Add empty slots for days before the first day
  for (let i = 0; i < firstWeekday; i++) {
    currentWeek.push(new Date(0)); // Placeholder for empty days
  }
  
  days.forEach((day, index) => {
    const weekday = getWeekday(day);
    currentWeek.push(day);
    
    // If it's Saturday (6) or the last day, start a new week
    if (weekday === 6 || index === days.length - 1) {
      // Fill remaining days of the week if it's the last day
      if (index === days.length - 1 && weekday !== 6) {
        for (let i = weekday + 1; i < 7; i++) {
          currentWeek.push(new Date(0)); // Placeholder for empty days
        }
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  // Get only the most recent weeks that fit on screen
  const displayWeeks = weeks.slice(-visibleWeeks);

  const getMoodColor = (date: Date): string => {
    const dateKey = formatDate(date);
    const entry = entries.get(dateKey);
    if (entry) {
      return CONTRIBUTION_GRAPH_COLORS[entry.mood as keyof typeof CONTRIBUTION_GRAPH_COLORS] || CONTRIBUTION_GRAPH_COLORS[0];
    }
    // Dark tile for days without entries
    return "#161b22";
  };

  const getEntryInfo = (date: Date) => {
    const dateKey = formatDate(date);
    return entries.get(dateKey);
  };

  const handleTileClick = (date: Date) => {
    const dateKey = formatDate(date);
    const entry = entries.get(dateKey);
    if (entry) {
      router.push(`/entries/${dateKey}`);
    } else {
      // If no entry exists, go to journal page to create one
      router.push(`/journal?date=${dateKey}`);
    }
  };

  // Calculate display info
  const weeksCount = displayWeeks.length;
  const monthsCount = Math.round(weeksCount / 4.33);

  return (
    <div className="bg-github-dark border border-github-dark-border rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-semibold">
          {visibleWeeks < 52 ? `Journal Activity (Last ${monthsCount} months)` : "Journal Activity (Last Year)"}
        </h2>
        {visibleWeeks < 52 && (
          <span className="text-xs text-gray-500">
            Showing most recent {weeksCount} weeks
          </span>
        )}
      </div>
      <div className={`${visibleWeeks >= 52 ? 'flex justify-end' : 'w-full overflow-hidden'}`}>
        <div className={`flex justify-end ${visibleWeeks >= 52 ? 'flex-shrink-0' : 'w-full'}`}>
          <div className="flex gap-1 flex-shrink-0">
            {displayWeeks.map((week, weekIndex) => {
              // Calculate actual week index in full array for unique keys
              const actualWeekIndex = weeks.length - displayWeeks.length + weekIndex;
              return (
                <div key={actualWeekIndex} className="flex flex-col gap-1 flex-shrink-0">
                  {week.map((day, dayIndex) => {
                    // Skip placeholder days
                    if (day.getTime() === 0) {
                      return (
                        <div
                          key={dayIndex}
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: "transparent" }}
                        />
                      );
                    }

                    const dateKey = formatDate(day);
                    const entry = getEntryInfo(day);
                    const isHovered = hoveredDate === dateKey;
                    const color = getMoodColor(day);

                    return (
                      <div
                        key={dayIndex}
                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm cursor-pointer transition-all touch-manipulation"
                        style={{
                          backgroundColor: color,
                          border: isHovered ? "2px solid #58a6ff" : "1px solid rgba(255,255,255,0.05)",
                          transform: isHovered ? "scale(1.15)" : "scale(1)",
                        }}
                        onMouseEnter={() => setHoveredDate(dateKey)}
                        onMouseLeave={() => setHoveredDate(null)}
                        onTouchStart={() => setHoveredDate(dateKey)}
                        onClick={() => handleTileClick(day)}
                        title={entry ? `${dateKey} - Mood: ${entry.mood}/5` : dateKey}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {(entriesCount !== undefined || syncedDaysCount !== undefined) && (
        <div className="mt-3 flex justify-end text-xs sm:text-sm text-gray-400">
          {entriesCount !== undefined && syncedDaysCount !== undefined ? (
            <span>{entriesCount} entries • {syncedDaysCount} synced days</span>
          ) : entriesCount !== undefined ? (
            <span>{entriesCount} entries</span>
          ) : (
            <span>{syncedDaysCount} synced days</span>
          )}
        </div>
      )}
      <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs sm:text-sm text-gray-400">
        <span>Less</span>
        <div className="flex gap-1">
          <div
            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm"
            style={{ backgroundColor: "#161b22", border: "1px solid rgba(255,255,255,0.05)" }}
            title="No entry"
          />
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm"
              style={{ backgroundColor: CONTRIBUTION_GRAPH_COLORS[level as keyof typeof CONTRIBUTION_GRAPH_COLORS] }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
      {hoveredDate && (
        <div className="mt-2 text-xs sm:text-sm text-gray-400">
          {hoveredDate}
          {entries.get(hoveredDate) && ` - Mood: ${entries.get(hoveredDate)!.mood}/5`}
        </div>
      )}
    </div>
  );
}

