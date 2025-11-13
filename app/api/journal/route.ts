import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getJournalEntry,
  saveJournalEntry,
  getAllJournalEntries,
  getJournalEntriesByYear,
} from "@/lib/storage";
import { JournalEntry } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const year = searchParams.get("year");

    if (date) {
      const entry = getJournalEntry(session.user.githubId, date);
      if (!entry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      return NextResponse.json(entry);
    }

    if (year) {
      const entries = getJournalEntriesByYear(session.user.githubId, parseInt(year));
      return NextResponse.json(Object.fromEntries(entries));
    }

    const entries = getAllJournalEntries(session.user.githubId);
    return NextResponse.json(entries);
  } catch (error) {
    console.error("Journal API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entry: JournalEntry = await req.json();
    saveJournalEntry(session.user.githubId, entry);

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error("Journal API error:", error);
    return NextResponse.json(
      { error: "Failed to save journal entry" },
      { status: 500 }
    );
  }
}

