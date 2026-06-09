import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { calculateScore } from "@/lib/scoring/calculator";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("game_id");
  const homeScore = Number(searchParams.get("home"));
  const awayScore = Number(searchParams.get("away"));

  if (!gameId || isNaN(homeScore) || isNaN(awayScore)) {
    return NextResponse.json(
      { error: "Params obrigatórios: game_id, home, away" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: game } = await supabase
    .from("games")
    .select("id, home_team, away_team, locked_home_win_prob, locked_draw_prob, locked_away_win_prob")
    .eq("id", gameId)
    .single();

  if (!game) {
    return NextResponse.json({ error: "Jogo não encontrado" }, { status: 404 });
  }

  const { data: predictions } = await supabase
    .from("predictions")
    .select("user_id, home_score, away_score")
    .eq("game_id", gameId);

  if (!predictions || predictions.length === 0) {
    return NextResponse.json({ message: "Nenhum palpite encontrado para esse jogo", scored: 0 });
  }

  // Usa odds travadas se existirem; caso contrário, usa odds atuais (simulação pré-jogo)
  let lockedProbs: { home: number; draw: number; away: number } | null = null;
  if (game.locked_home_win_prob) {
    lockedProbs = {
      home: game.locked_home_win_prob,
      draw: game.locked_draw_prob!,
      away: game.locked_away_win_prob!,
    };
  } else {
    const { data: odds } = await supabase
      .from("odds")
      .select("home_win_prob, draw_prob, away_win_prob")
      .eq("game_id", gameId)
      .single();
    if (odds) {
      lockedProbs = {
        home: odds.home_win_prob,
        draw: odds.draw_prob,
        away: odds.away_win_prob,
      };
    }
  }

  const now = new Date().toISOString();

  const scoreRows = predictions.map((p) => {
    const result = calculateScore(
      { home: p.home_score, away: p.away_score },
      { home: homeScore, away: awayScore },
      lockedProbs
    );
    return {
      user_id: p.user_id,
      game_id: gameId,
      base_points: result.basePoints,
      odds_bonus: result.exactBonus,
      breakdown: result.breakdown as unknown as Record<string, boolean>,
      calculated_at: now,
    };
  });

  const { error } = await supabase
    .from("game_scores")
    .upsert(scoreRows, { onConflict: "user_id,game_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "Pontuações calculadas",
    game: `${game.home_team} vs ${game.away_team}`,
    result: `${homeScore} – ${awayScore}`,
    lockedProbs,
    scored: scoreRows.length,
    breakdown: scoreRows.map((r) => ({
      user_id: r.user_id,
      base_points: r.base_points,
      odds_bonus: r.odds_bonus,
      total: r.base_points + r.odds_bonus,
      breakdown: r.breakdown,
    })),
  });
}
