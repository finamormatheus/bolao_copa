import { NextResponse } from "next/server";
import {
  fetchWorldCupMatches,
  mapStatus,
  mapStage,
  mapGroup,
  oddsToProbs,
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

    // Upsert odds que já vierem junto com os jogos
    let oddsCount = 0;
    for (const m of matches) {
      if (!m.odds?.homeWin || !m.odds?.draw || !m.odds?.awayWin) continue;

      const { data: game } = await supabase
        .from("games")
        .select("id")
        .eq("api_id", m.id)
        .single();

      if (!game) continue;

      const probs = oddsToProbs(m.odds.homeWin, m.odds.draw, m.odds.awayWin);

      await supabase.from("odds").upsert(
        {
          game_id: game.id,
          home_win_prob: probs.home,
          draw_prob: probs.draw,
          away_win_prob: probs.away,
        },
        { onConflict: "game_id" }
      );
      oddsCount++;
    }

    return NextResponse.json({
      message: "Synced successfully",
      synced: gameRows.length,
      odds: oddsCount,
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
