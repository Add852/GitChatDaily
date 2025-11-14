"use client";

import { useEffect, useState } from "react";
import { JournalEntry } from "@/types";
import { CONTRIBUTION_GRAPH_COLORS } from "@/lib/constants";
import { getDaysInYear, getWeekday, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ContributionGraphProps {
  entries: Map<string, JournalEntry>;
  year?: number;
}

export function ContributionGraph({ entries, year = new Date().getFullYear() }: ContributionGraphProps) {
  const router = useRouter();
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  
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

  const getMoodColor = (date: Date): string => {
    const dateKey = formatDate(date);
    const entry = entries.get(dateKey);
    if (entry) {
      return CONTRIBUTION_GRAPH_COLORS[entry.mood as keyof typeof CONTRIBUTION_GRAPH_COLORS] || CONTRIBUTION_GRAPH_COLORS[0];
    }
    // Gray for non-existent entries (GitHub style)
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

  return (
    <div className="bg-github-dark border border-github-dark-border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Journal Activity (Last Year)</h2>
      <div className="overflow-x-hidden">
        <div className="flex gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
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
                    className="w-3 h-3 rounded-sm cursor-pointer transition-all"
                    style={{
                      backgroundColor: color,
                      border: isHovered ? "2px solid #58a6ff" : "1px solid rgba(255,255,255,0.05)",
                      transform: isHovered ? "scale(1.15)" : "scale(1)",
                    }}
                    onMouseEnter={() => setHoveredDate(dateKey)}
                    onMouseLeave={() => setHoveredDate(null)}
                    onClick={() => handleTileClick(day)}
                    title={entry ? `${dateKey} - Mood: ${entry.mood}/5` : dateKey}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
        <span>Less</span>
        <div className="flex gap-1">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "#161b22", border: "1px solid rgba(255,255,255,0.05)" }}
            title="No entry"
          />
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: CONTRIBUTION_GRAPH_COLORS[level as keyof typeof CONTRIBUTION_GRAPH_COLORS] }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
      {hoveredDate && (
        <div className="mt-2 text-sm text-gray-400">
          {hoveredDate}
          {entries.get(hoveredDate) && ` - Mood: ${entries.get(hoveredDate)!.mood}/5`}
        </div>
      )}
    </div>
  );
}

