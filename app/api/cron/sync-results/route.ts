import { NextResponse } from "next/server";
import { fetchAllGames, mapStatus, deriveWinner } from "@/lib/worldcup26/client";
import { fetchLiveMatches } from "@/lib/api-football/client";
import type { FDMatch } from "@/lib/api-football/types";
import { syncFixtures } from "@/lib/worldcup26/sync-fixtures";
import { createServiceClient } from "@/lib/supabase/service";
import { calculateScore } from "@/lib/scoring/calculator";

function normTeam(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "");
}

function bestScores(
  wc26Home: number | null, wc26Away: number | null,
  fdHome: number | null, fdAway: number | null
): { home: number | null; away: number | null } {
  const wc26Valid = wc26Home !== null && wc26Away !== null;
  const fdValid = fdHome !== null && fdAway !== null;
  if (!wc26Valid && !fdValid) return { home: null, away: null };
  if (!wc26Valid) return { home: fdHome, away: fdAway };
  if (!fdValid) return { home: wc26Home, away: wc26Away };
  // Both valid — higher total goals = data captured later in the match
  return (fdHome + fdAway) > (wc26Home + wc26Away)
    ? { home: fdHome, away: fdAway }
    : { home: wc26Home, away: wc26Away };
}

async function saveRankingSnapshots(
  supabase: ReturnType<typeof createServiceClient>,
  gameDay: string
) {
  const { data: groups } = await supabase.from("groups").select("id");
  if (!groups?.length) return;

  // Only include scores from games that kicked off on or before this game_day (UTC).
  // This prevents a late-night cron run from including next-day game points in today's snapshot.
  const { data: eligibleGames } = await supabase
    .from("games")
    .select("id")
    .lte("match_date", `${gameDay}T23:59:59.999Z`);
  const eligibleGameIds = (eligibleGames ?? []).map((g) => g.id);

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
      supabase
        .from("game_scores")
        .select("user_id, total_points, breakdown")
        .in("user_id", userIds)
        .in("game_id", eligibleGameIds.length > 0 ? eligibleGameIds : [""]),
      supabase.from("champion_picks").select("user_id, points_awarded").in("user_id", userIds),
    ]);

    const pointsByUser: Record<string, number> = Object.fromEntries(userIds.map((id) => [id, 0]));
    const exactByUser: Record<string, number> = Object.fromEntries(userIds.map((id) => [id, 0]));
    for (const s of gameScores ?? []) {
      if (s.user_id in pointsByUser) {
        pointsByUser[s.user_id] += s.total_points ?? 0;
        const bd = s.breakdown as { exact?: boolean } | null;
        if (bd?.exact) exactByUser[s.user_id] += 1;
      }
    }
    for (const cp of championPicks ?? []) {
      if (cp.user_id in pointsByUser) pointsByUser[cp.user_id] += cp.points_awarded ?? 0;
    }

    const rows = Object.entries(pointsByUser)
      .sort((a, b) =>
        b[1] - a[1] ||
        exactByUser[b[0]] - exactByUser[a[0]] ||
        a[0].localeCompare(b[0])
      )
      .map(([userId, points], i) => ({
        group_id: group.id,
        game_day: gameDay,
        user_id: userId,
        rank: i + 1,
        points,
      }));

    const { error } = await supabase
      .from("ranking_snapshots")
      .upsert(rows, { onConflict: "group_id,game_day,user_id" });

    if (error) {
      console.error(`[sync-results] snapshot upsert failed for group ${group.id} day ${gameDay}:`, error);
    }
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
    // ── Verifica DB antes de chamar a API ─────────────────────────────────────
    const [{ data: liveGames }, { data: justStarted }] = await Promise.all([
      supabase.from("games").select("id").in("status", ["LIVE", "HT"]),
      supabase
        .from("games")
        .select("id")
        .eq("status", "NS")
        .lte("match_date", now.toISOString()),
    ]);

    // Jogos finalizados nas últimas 6h com palpites mas sem pontuação calculada
    const cutoff6h = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const { data: finishedGames } = await supabase
      .from("games")
      .select("id")
      .in("status", ["FT", "FINISHED"])
      .gt("match_date", cutoff6h);

    let hasUnscored = false;
    if (finishedGames?.length) {
      const ids = finishedGames.map((g) => g.id);
      const { data: scored } = await supabase
        .from("game_scores")
        .select("game_id")
        .in("game_id", ids);
      const scoredSet = new Set(scored?.map((s) => s.game_id));
      hasUnscored = ids.some((id) => !scoredSet.has(id));
    }

    const hasActivity =
      (liveGames?.length ?? 0) > 0 ||
      (justStarted?.length ?? 0) > 0 ||
      hasUnscored;
    const isTopOfHour = now.getMinutes() < 2;

    if (!hasActivity && !isTopOfHour) {
      return NextResponse.json({ message: "Nothing to sync", skipped: true });
    }

    // ── Busca jogos de ambas as APIs em paralelo ──────────────────────────────
    // worldcup26.ir retorna os 104 jogos; football-data só retorna jogos ao vivo.
    // allSettled garante que uma falha em uma fonte não aborta o sync.
    const [wc26Result, fdResult] = await Promise.allSettled([
      fetchAllGames(),
      fetchLiveMatches(),
    ]);

    if (wc26Result.status === "rejected") {
      console.error("[sync-results] worldcup26.ir fetch failed:", wc26Result.reason);
      return NextResponse.json(
        { error: "Failed to fetch from worldcup26.ir", details: String(wc26Result.reason) },
        { status: 500 }
      );
    }
    const allGames = wc26Result.value;

    if (fdResult.status === "rejected") {
      console.warn("[sync-results] football-data.org fetch failed (proceeding with wc26 only):", fdResult.reason);
    }
    const fdMatches: FDMatch[] = fdResult.status === "fulfilled" ? fdResult.value : [];

    const needsFullSync =
      isTopOfHour || (justStarted?.length ?? 0) > 0 || hasUnscored;

    // Se só há jogos ao vivo confirmados, filtra em memória (evita processar 104 rows desnecessariamente)
    const games = needsFullSync
      ? allGames
      : allGames.filter((g) => g.time_elapsed !== "notstarted");

    if (games.length === 0) {
      return NextResponse.json({ message: "No matches returned", updated: 0, scored: 0 });
    }

    // Monta lookup de partidas ao vivo do football-data indexado por nomes normalizados
    const fdByKey = new Map<string, FDMatch>();
    for (const m of fdMatches) {
      const key1 = `${normTeam(m.homeTeam.name)}|${normTeam(m.awayTeam.name)}`;
      const key2 = `${normTeam(m.homeTeam.shortName)}|${normTeam(m.awayTeam.shortName)}`;
      fdByKey.set(key1, m);
      if (key2 !== key1) fdByKey.set(key2, m);
    }

    let updated = 0;
    let scored = 0;
    let shouldSyncFixtures = false;
    const scoredGameDays = new Set<string>();

    const parseScore = (s: string): number | null => { const n = parseInt(s, 10); return isNaN(n) ? null : n; };

    for (const game of games) {
      if (!game.home_team_name_en || !game.away_team_name_en) continue;
      const status = mapStatus(game.time_elapsed);
      const isLiveOrFinished = LIVE_STATUSES.includes(status) || status === FINISHED_STATUS;
      const wc26Home = isLiveOrFinished ? parseScore(game.home_score) : null;
      const wc26Away = isLiveOrFinished ? parseScore(game.away_score) : null;

      // Busca placar do football-data para este jogo (se disponível)
      const fdKey = `${normTeam(game.home_team_name_en)}|${normTeam(game.away_team_name_en)}`;
      const fdMatch = fdByKey.get(fdKey);
      const fdHome = fdMatch?.score.fullTime.home ?? null;
      const fdAway = fdMatch?.score.fullTime.away ?? null;

      // Usa o placar mais atualizado entre as duas fontes
      const { home: bestHome, away: bestAway } = bestScores(wc26Home, wc26Away, fdHome, fdAway);

      // Só sobrescreve placar se temos dados válidos — nunca apaga com null
      const scoreUpdate = (bestHome !== null && bestAway !== null)
        ? { home_score: bestHome, away_score: bestAway }
        : {};

      const { data: dbGame } = await supabase
        .from("games")
        .update({ status, ...scoreUpdate })
        .eq("wc26_api_id", game.id)
        .select(
          "id, stage, match_date, home_team, away_team, home_score, away_score, locked_home_win_prob, locked_draw_prob, locked_away_win_prob"
        )
        .single();

      if (!dbGame) continue;
      updated++;

      // Trava odds quando jogo começa ao vivo (ou vai direto NS→FT) e ainda não foram travadas
      let freshLockedProbs: { home: number; draw: number; away: number } | null = null;
      if ((LIVE_STATUSES.includes(status) || status === FINISHED_STATUS) && !dbGame.locked_home_win_prob) {
        const { data: currentOdds } = await supabase
          .from("odds")
          .select("home_win_prob, draw_prob, away_win_prob")
          .eq("game_id", dbGame.id)
          .single();

        if (currentOdds) {
          await supabase
            .from("games")
            .update({
              locked_home_win_prob: currentOdds.home_win_prob,
              locked_draw_prob: currentOdds.draw_prob,
              locked_away_win_prob: currentOdds.away_win_prob,
            })
            .eq("id", dbGame.id);
          freshLockedProbs = {
            home: currentOdds.home_win_prob,
            draw: currentOdds.draw_prob,
            away: currentOdds.away_win_prob,
          };
        }
      }

      // Para cálculo de pontos: usa o melhor placar desta rodada ou o que já está salvo no DB
      const finalHome = bestHome ?? dbGame.home_score;
      const finalAway = bestAway ?? dbGame.away_score;

      // Calcula pontuações quando jogo termina
      if (status === FINISHED_STATUS && finalHome !== null && finalAway !== null) {
        const { data: predictions } = await supabase
          .from("predictions")
          .select("user_id, home_score, away_score")
          .eq("game_id", dbGame.id);

        if (predictions && predictions.length > 0) {
          const lockedProbs = dbGame.locked_home_win_prob
            ? {
                home: dbGame.locked_home_win_prob,
                draw: dbGame.locked_draw_prob!,
                away: dbGame.locked_away_win_prob!,
              }
            : freshLockedProbs;

          const scoreRows = predictions.map((p) => {
            const result = calculateScore(
              { home: p.home_score, away: p.away_score },
              { home: finalHome, away: finalAway },
              lockedProbs
            );
            return {
              user_id: p.user_id,
              game_id: dbGame.id,
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
            shouldSyncFixtures = true;
            // UTC-5 offset: games up to 2am Brasília (BRT=UTC-3) are attributed to the previous calendar day
            const kickoffUtc5 = new Date(new Date(dbGame.match_date).getTime() - 5 * 60 * 60 * 1000);
            scoredGameDays.add(kickoffUtc5.toISOString().split("T")[0]);
          }
        }

        // Calcula pontos de campeão quando a Final termina
        if (dbGame.stage === "Final") {
          const winner = deriveWinner(String(finalHome), String(finalAway));
          if (winner && winner !== "DRAW") {
            const champion = winner === "HOME" ? dbGame.home_team : dbGame.away_team;

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
    }

    // Snapshots from games scored in this run
    for (const gameDay of scoredGameDays) {
      await saveRankingSnapshots(supabase, gameDay);
    }

    // On full syncs (top-of-hour or cold start), also snapshot all FT game days
    // so the table stays up to date even when no new scores were computed.
    if (needsFullSync && scoredGameDays.size === 0) {
      const { data: ftGames } = await supabase
        .from("games")
        .select("match_date")
        .eq("status", "FT");
      const ftGameDays = new Set(
        (ftGames ?? []).map((g) => {
          const kickoffUtc5 = new Date(new Date(g.match_date).getTime() - 5 * 60 * 60 * 1000);
          return kickoffUtc5.toISOString().split("T")[0];
        })
      );
      for (const gameDay of ftGameDays) {
        await saveRankingSnapshots(supabase, gameDay);
      }
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
