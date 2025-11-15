import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getJournalEntry,
  saveJournalEntry,
  getAllJournalEntries,
  getJournalEntriesByYear,
  deleteJournalEntry,
} from "@/lib/storage";
import { JournalEntry } from "@/types";
import {
  fetchJournalEntriesFromGitHub,
  deleteJournalEntryFromGitHub,
} from "@/lib/github-journal";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const year = searchParams.get("year");
    const userId = session.user.githubId;
    const accessToken = session.user.accessToken;

    const hydrateEntries = async (): Promise<JournalEntry[]> => {
      let entries = getAllJournalEntries(userId);
      if (entries.length === 0 && accessToken) {
        entries = await fetchJournalEntriesFromGitHub(accessToken, userId);
        entries.forEach((entry) => saveJournalEntry(userId, entry));
      }
      return entries;
    };

    if (date) {
      let entry = getJournalEntry(userId, date);
      if (!entry && accessToken) {
        const remoteEntries = await hydrateEntries();
        entry = remoteEntries.find((item) => item.date === date);
      }
      if (!entry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      return NextResponse.json(entry);
    }

    if (year) {
      await hydrateEntries();
      const entries = getJournalEntriesByYear(userId, parseInt(year, 10));
      return NextResponse.json(Object.fromEntries(entries));
    }

    const entries = await hydrateEntries();
    return NextResponse.json(entries);
  } catch (error) {
    console.error("Journal API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    deleteJournalEntry(session.user.githubId, date);

    if (session.user.accessToken) {
      try {
        await deleteJournalEntryFromGitHub(session.user.accessToken, date);
      } catch (error) {
        console.error("Error deleting GitHub entry:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Journal delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete journal entry" },
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

