import { NextResponse } from "next/server";
import { syncFixtures } from "@/lib/api-football/sync-fixtures";

function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { synced } = await syncFixtures();

    if (synced === 0) {
      return NextResponse.json({ message: "No matches found", synced: 0 });
    }

    return NextResponse.json({ message: "Synced successfully", synced });
  } catch (err: unknown) {
    console.error("[sync-fixtures]", err);
    const details = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: "Failed to sync fixtures", details },
      { status: 500 }
    );
  }
}
