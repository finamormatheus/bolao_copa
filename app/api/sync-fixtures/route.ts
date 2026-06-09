import { NextResponse } from "next/server";
import {
  fetchWorldCupMatches,
  mapStatus,
  mapStage,
  mapGroup,
} from "@/lib/api-football/client";
import { createServiceClient } from "@/lib/supabase/service";

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
    const matches = await fetchWorldCupMatches();

    if (matches.length === 0) {
      return NextResponse.json({ message: "No matches found", synced: 0 });
    }

    const supabase = createServiceClient();

    const gameRows = matches.map((m) => ({
      api_id: m.id,
      home_team: m.homeTeam.name ?? "TBD",
      away_team: m.awayTeam.name ?? "TBD",
      home_team_logo: m.homeTeam.crest ?? null,
      away_team_logo: m.awayTeam.crest ?? null,
      home_score: m.score.fullTime.home,
      away_score: m.score.fullTime.away,
      status: mapStatus(m.status),
      match_date: m.utcDate,
      stage: mapStage(m.stage),
      group_name: mapGroup(m.group),
    }));

    const { error: gamesError } = await supabase
      .from("games")
      .upsert(gameRows, { onConflict: "api_id", ignoreDuplicates: false });

    if (gamesError) throw gamesError;

    return NextResponse.json({
      message: "Synced successfully",
      synced: gameRows.length,
    });
  } catch (err: unknown) {
    console.error("[sync-fixtures]", err);
    const details = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: "Failed to sync fixtures", details },
      { status: 500 }
    );
  }
}
