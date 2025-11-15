import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { saveJournalEntry } from "@/lib/storage";
import { fetchJournalEntriesFromGitHub } from "@/lib/github-journal";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accessToken || !session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await fetchJournalEntriesFromGitHub(
      session.user.accessToken,
      session.user.githubId
    );

    entries.forEach((entry) => saveJournalEntry(session.user.githubId!, entry));

    return NextResponse.json({
      synced: entries.length,
      message: `Synced ${entries.length} entries`,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync entries from GitHub" },
      { status: 500 }
    );
  }
}
