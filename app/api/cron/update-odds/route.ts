import { NextResponse } from "next/server";
import { fetchMatchesByDate, oddsToProbs, mapStatus } from "@/lib/api-football/client";
import { createServiceClient } from "@/lib/supabase/service";

function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

const LOCK_WINDOW_MINUTES = 5;

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    const matches = await fetchMatchesByDate(today);

    if (matches.length === 0) {
      return NextResponse.json({ message: "No matches today", updated: 0, locked: 0 });
    }

    let updated = 0;
    let locked = 0;

    for (const m of matches) {
      if (!m.odds?.homeWin || !m.odds?.draw || !m.odds?.awayWin) continue;

      const probs = oddsToProbs(m.odds.homeWin, m.odds.draw, m.odds.awayWin);

      const { data: game } = await supabase
        .from("games")
        .select("id, match_date, locked_home_win_prob")
        .eq("api_id", m.id)
        .single();

      if (!game) continue;

      // Atualiza status e placar também aproveita a chamada
      await supabase.from("games").update({ status: mapStatus(m.status) }).eq("id", game.id);

      // Upsert odds atuais
      await supabase.from("odds").upsert(
        {
          game_id: game.id,
          home_win_prob: probs.home,
          draw_prob: probs.draw,
          away_win_prob: probs.away,
          updated_at: now.toISOString(),
        },
        { onConflict: "game_id" }
      );
      updated++;

      // Lock odds se jogo começa em < LOCK_WINDOW_MINUTES e ainda não foi travado
      const minutesUntilGame =
        (new Date(game.match_date).getTime() - now.getTime()) / 60000;

      if (minutesUntilGame <= LOCK_WINDOW_MINUTES && !game.locked_home_win_prob) {
        await supabase
          .from("games")
          .update({
            locked_home_win_prob: probs.home,
            locked_draw_prob: probs.draw,
            locked_away_win_prob: probs.away,
          })
          .eq("id", game.id);
        locked++;
      }
    }

    return NextResponse.json({ message: "Odds updated", updated, locked });
  } catch (err) {
    console.error("[update-odds]", err);
    return NextResponse.json(
      { error: "Failed to update odds", details: String(err) },
      { status: 500 }
    );
  }
}
