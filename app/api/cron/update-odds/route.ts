import { NextResponse } from "next/server";
import {
  fetchWorldCupOdds,
  averageH2HOdds,
  normalizeTeamName,
} from "@/lib/the-odds-api/client";
import { oddsToProbs } from "@/lib/api-football/client";
import { createServiceClient } from "@/lib/supabase/service";

function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// Janelas de agendamento (em horas)
const WINDOW_24H = { minH: 22, maxH: 26 };
const WINDOW_1H = { minMin: 30, maxMin: 90 };

type GameRow = { id: string; home_team: string; away_team: string; match_date: string };

async function updateOddsForGames(
  games: GameRow[],
  supabase: ReturnType<typeof import("@/lib/supabase/service").createServiceClient>,
  now: Date,
  debug = false
) {
  if (games.length === 0) return { updated: 0, unmatched: [] };

  // Uma única chamada à The Odds API para todos os jogos qualificados
  const events = await fetchWorldCupOdds();

  const eventIndex = new Map<string, (typeof events)[number]>();
  for (const ev of events) {
    const key = `${normalizeTeamName(ev.home_team)}|${normalizeTeamName(ev.away_team)}`;
    eventIndex.set(key, ev);
  }

  let updated = 0;
  const unmatched: string[] = [];

  for (const game of games) {
    const key = `${normalizeTeamName(game.home_team)}|${normalizeTeamName(game.away_team)}`;
    const event = eventIndex.get(key);
    if (!event) {
      if (debug) unmatched.push(`DB: "${game.home_team}" vs "${game.away_team}"`);
      continue;
    }

    const rawOdds = averageH2HOdds(event);
    if (!rawOdds) continue;

    const probs = oddsToProbs(rawOdds.homeOdd, rawOdds.drawOdd, rawOdds.awayOdd);

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
  }
  return { updated, unmatched };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode"); // "initial" | null (scheduled)

  try {
    const supabase = createServiceClient();
    const now = new Date();

    // ── Modo inicial: busca odds de todos os jogos futuros de uma vez ──────────
    if (mode === "initial") {
      const { data: allGames } = await supabase
        .from("games")
        .select("id, home_team, away_team, match_date")
        .eq("status", "NS")
        .gt("match_date", now.toISOString());

      const games = allGames ?? [];
      const debug = searchParams.get("debug") === "1";
      const { updated, unmatched } = await updateOddsForGames(games, supabase, now, debug);
      const response: Record<string, unknown> = { message: "Initial odds loaded", updated };
      if (debug) response.unmatched = unmatched;
      return NextResponse.json(response);
    }

    // ── Modo agendado: verifica janelas de 24h e 1h ────────────────────────────
    const in24hFrom = new Date(now.getTime() + WINDOW_24H.minH * 3600 * 1000);
    const in24hTo = new Date(now.getTime() + WINDOW_24H.maxH * 3600 * 1000);
    const in1hFrom = new Date(now.getTime() + WINDOW_1H.minMin * 60 * 1000);
    const in1hTo = new Date(now.getTime() + WINDOW_1H.maxMin * 60 * 1000);

    const [{ data: needs24h }, { data: needs1h }] = await Promise.all([
      supabase
        .from("games")
        .select("id, home_team, away_team, match_date")
        .eq("status", "NS")
        .eq("odds_fetched_24h", false)
        .gte("match_date", in24hFrom.toISOString())
        .lte("match_date", in24hTo.toISOString()),
      supabase
        .from("games")
        .select("id, home_team, away_team, match_date")
        .eq("status", "NS")
        .eq("odds_fetched_1h", false)
        .gte("match_date", in1hFrom.toISOString())
        .lte("match_date", in1hTo.toISOString()),
    ]);

    if (!needs24h?.length && !needs1h?.length) {
      return NextResponse.json({ message: "No odds updates needed", updated: 0 });
    }

    // Deduplica jogos (um jogo pode estar nas duas janelas se a cron atrasou)
    const seenIds = new Set<string>();
    const allGames: GameRow[] = [];
    for (const g of [...(needs24h ?? []), ...(needs1h ?? [])]) {
      if (!seenIds.has(g.id)) {
        seenIds.add(g.id);
        allGames.push(g);
      }
    }

    const { updated } = await updateOddsForGames(allGames, supabase, now);

    // Marca flags nos jogos atualizados
    if (needs24h?.length) {
      await supabase
        .from("games")
        .update({ odds_fetched_24h: true })
        .in("id", needs24h.map((g) => g.id));
    }
    if (needs1h?.length) {
      await supabase
        .from("games")
        .update({ odds_fetched_1h: true })
        .in("id", needs1h.map((g) => g.id));
    }

    return NextResponse.json({
      message: "Odds updated",
      updated,
      windows: { "24h": needs24h?.length ?? 0, "1h": needs1h?.length ?? 0 },
    });
  } catch (err) {
    console.error("[update-odds]", err);
    return NextResponse.json(
      { error: "Failed to update odds", details: String(err) },
      { status: 500 }
    );
  }
}
