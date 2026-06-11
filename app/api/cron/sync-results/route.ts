import { NextResponse } from "next/server";
import { fetchLiveMatches, fetchMatchesByDate, mapStatus } from "@/lib/api-football/client";
import { syncFixtures } from "@/lib/api-football/sync-fixtures";
import { createServiceClient } from "@/lib/supabase/service";
import { calculateScore } from "@/lib/scoring/calculator";

async function saveRankingSnapshots(
  supabase: ReturnType<typeof createServiceClient>,
  gameDay: string
) {
  const { data: groups } = await supabase.from("groups").select("id");
  if (!groups?.length) return;

  for (const group of groups) {
    const { data: members } = await supabase
      .from("group_members")
      .select("email")
      .eq("group_id", group.id);

    if (!members?.length) continue;

    const emails = members.map((m) => m.email);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .in("email", emails);

    if (!profiles?.length) continue;

    const userIds = profiles.map((p) => p.id);

    const [{ data: gameScores }, { data: championPicks }] = await Promise.all([
      supabase.from("game_scores").select("user_id, total_points").in("user_id", userIds),
      supabase.from("champion_picks").select("user_id, points_awarded").in("user_id", userIds),
    ]);

    const pointsByUser: Record<string, number> = Object.fromEntries(
      userIds.map((id) => [id, 0])
    );
    for (const s of gameScores ?? []) {
      if (s.user_id in pointsByUser) pointsByUser[s.user_id] += s.total_points ?? 0;
    }
    for (const cp of championPicks ?? []) {
      if (cp.user_id in pointsByUser) pointsByUser[cp.user_id] += cp.points_awarded ?? 0;
    }

    const rows = Object.entries(pointsByUser)
      .sort((a, b) => b[1] - a[1])
      .map(([userId, points], i) => ({
        group_id: group.id,
        game_day: gameDay,
        user_id: userId,
        rank: i + 1,
        points,
      }));

    await (supabase as any)
      .from("ranking_snapshots")
      .upsert(rows, { onConflict: "group_id,game_day,user_id" });
  }
}

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
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // ── Verifica DB antes de chamar football-data.org ─────────────────────────
    const [{ data: liveGames }, { data: justStarted }] = await Promise.all([
      supabase.from("games").select("id").in("status", ["LIVE", "HT"]),
      // Jogos agendados que já deveriam ter começado (captura NS → LIVE)
      supabase
        .from("games")
        .select("id")
        .eq("status", "NS")
        .lte("match_date", now.toISOString()),
    ]);

    const hasActivity = (liveGames?.length ?? 0) > 0 || (justStarted?.length ?? 0) > 0;
    // Sync completo no topo da hora para capturar status de jogos do dia
    const isTopOfHour = now.getMinutes() < 2;

    if (!hasActivity && !isTopOfHour) {
      return NextResponse.json({ message: "Nothing to sync", skipped: true });
    }

    // ── Busca dados do football-data.org ───────────────────────────────────────
    // - Topo de hora ou jogos NS que já passaram da hora: busca todos do dia
    //   (garante capturar jogos que foram de NS → FT sem serem pegos ao vivo)
    // - Apenas ao vivo confirmado: somente partidas live (1 req, mais rápido)
    const needsFullSync = isTopOfHour || (justStarted?.length ?? 0) > 0;
    const matches = needsFullSync
      ? await fetchMatchesByDate(today)
      : await fetchLiveMatches();

    if (matches.length === 0) {
      return NextResponse.json({ message: "No matches returned", updated: 0, scored: 0 });
    }

    let updated = 0;
    let scored = 0;
    let shouldSyncFixtures = false;

    for (const match of matches) {
      const status = mapStatus(match.status);

      const { data: game } = await supabase
        .from("games")
        .update({
          status,
          home_score: match.score.fullTime.home,
          away_score: match.score.fullTime.away,
        })
        .eq("api_id", match.id)
        .select("id, stage, home_team, away_team, locked_home_win_prob, locked_draw_prob, locked_away_win_prob")
        .single();

      if (!game) continue;
      updated++;

      // Safety net: trava odds quando jogo começa ao vivo e ainda não foram travadas
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

        if (predictions && predictions.length > 0) {
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
              odds_bonus: result.exactBonus,
              breakdown: result.breakdown as unknown as Record<string, boolean>,
              calculated_at: now.toISOString(),
            };
          });

          const { error } = await supabase
            .from("game_scores")
            .upsert(scoreRows, { onConflict: "user_id,game_id" });

          if (!error) {
            scored += scoreRows.length;
            // Jogo terminou — atualiza fixtures para capturar eventuais mudanças de calendário
            shouldSyncFixtures = true;
          }
        }

        // Calcula pontos de campeão quando a Final termina
        if (game.stage === "Final" && match.score.winner && match.score.winner !== "DRAW") {
          const champion =
            match.score.winner === "HOME_TEAM" ? game.home_team : game.away_team;

          // Executa apenas uma vez (verifica se já foi calculado)
          const { data: alreadyCalc } = await supabase
            .from("champion_picks")
            .select("id")
            .not("calculated_at", "is", null)
            .limit(1);

          if (!alreadyCalc?.length) {
            await Promise.all([
              supabase
                .from("champion_picks")
                .update({ points_awarded: 20, calculated_at: now.toISOString() })
                .eq("team_name", champion),
              supabase
                .from("champion_picks")
                .update({ points_awarded: 0, calculated_at: now.toISOString() })
                .neq("team_name", champion)
                .is("calculated_at", null),
            ]);
          }
        }
      }
    }

    if (scored > 0) {
      await saveRankingSnapshots(supabase, today);
    }

    let fixturesSynced: number | undefined;
    if (shouldSyncFixtures) {
      try {
        const result = await syncFixtures();
        fixturesSynced = result.synced;
      } catch (err) {
        console.error("[sync-results] fixture sync after FT failed:", err);
      }
    }

    return NextResponse.json({
      message: "Results synced",
      updated,
      scored,
      ...(fixturesSynced !== undefined && { fixturesSynced }),
    });
  } catch (err) {
    console.error("[sync-results]", err);
    return NextResponse.json(
      { error: "Failed to sync results", details: String(err) },
      { status: 500 }
    );
  }
}
