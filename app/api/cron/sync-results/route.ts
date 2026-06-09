import { NextResponse } from "next/server";
import { fetchLiveMatches, mapStatus } from "@/lib/api-football/client";
import { createServiceClient } from "@/lib/supabase/service";
import { calculateScore } from "@/lib/scoring/calculator";

function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

const FINISHED_STATUS = "FT";
const LIVE_STATUSES = ["LIVE", "HT"];

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const liveMatches = await fetchLiveMatches();

    if (liveMatches.length === 0) {
      return NextResponse.json({ message: "No live games", updated: 0, scored: 0 });
    }

    let updated = 0;
    let scored = 0;

    for (const match of liveMatches) {
      const status = mapStatus(match.status);

      const { data: game } = await supabase
        .from("games")
        .update({
          status,
          home_score: match.score.fullTime.home,
          away_score: match.score.fullTime.away,
        })
        .eq("api_id", match.id)
        .select("id, locked_home_win_prob, locked_draw_prob, locked_away_win_prob")
        .single();

      if (!game) continue;
      updated++;

      // Se jogo passou para live e odds ainda não foram travadas, trava agora
      if (LIVE_STATUSES.includes(status) && !game.locked_home_win_prob) {
        const { data: currentOdds } = await supabase
          .from("odds")
          .select("home_win_prob, draw_prob, away_win_prob")
          .eq("game_id", game.id)
          .single();

        if (currentOdds) {
          await supabase
            .from("games")
            .update({
              locked_home_win_prob: currentOdds.home_win_prob,
              locked_draw_prob: currentOdds.draw_prob,
              locked_away_win_prob: currentOdds.away_win_prob,
            })
            .eq("id", game.id);
        }
      }

      // Calcula pontuações quando jogo termina
      if (
        status === FINISHED_STATUS &&
        match.score.fullTime.home !== null &&
        match.score.fullTime.away !== null
      ) {
        const { data: predictions } = await supabase
          .from("predictions")
          .select("user_id, home_score, away_score")
          .eq("game_id", game.id);

        if (!predictions || predictions.length === 0) continue;

        const lockedProbs = game.locked_home_win_prob
          ? {
              home: game.locked_home_win_prob,
              draw: game.locked_draw_prob!,
              away: game.locked_away_win_prob!,
            }
          : null;

        const scoreRows = predictions.map((p) => {
          const result = calculateScore(
            { home: p.home_score, away: p.away_score },
            { home: match.score.fullTime.home!, away: match.score.fullTime.away! },
            lockedProbs
          );
          return {
            user_id: p.user_id,
            game_id: game.id,
            base_points: result.basePoints,
            odds_bonus: result.oddsBonus,
            breakdown: result.breakdown as unknown as Record<string, boolean>,
            calculated_at: new Date().toISOString(),
          };
        });

        const { error } = await supabase
          .from("game_scores")
          .upsert(scoreRows, { onConflict: "user_id,game_id" });

        if (!error) scored += scoreRows.length;
      }
    }

    return NextResponse.json({ message: "Results synced", updated, scored });
  } catch (err) {
    console.error("[sync-results]", err);
    return NextResponse.json(
      { error: "Failed to sync results", details: String(err) },
      { status: 500 }
    );
  }
}
