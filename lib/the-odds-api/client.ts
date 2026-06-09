import type { OddsAPIEvent } from "./types";

const BASE_URL = "https://api.the-odds-api.com/v4";
const SPORT = "soccer_fifa_world_cup";

export async function fetchWorldCupOdds(
  commenceTimeFrom?: string,
  commenceTimeTo?: string
): Promise<OddsAPIEvent[]> {
  const url = new URL(`${BASE_URL}/sports/${SPORT}/odds/`);
  url.searchParams.set("apiKey", process.env.THE_ODDS_API_KEY!);
  url.searchParams.set("regions", "eu");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");
  if (commenceTimeFrom) url.searchParams.set("commenceTimeFrom", commenceTimeFrom);
  if (commenceTimeTo) url.searchParams.set("commenceTimeTo", commenceTimeTo);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`the-odds-api error ${res.status}: ${text}`);
  }

  return res.json();
}

// Mapeia variantes de nomes para um nome canônico compartilhado.
// Necessário porque football-data.org e The Odds API usam nomes diferentes.
const TEAM_ALIASES: Record<string, string> = {
  "south korea": "korea",
  "korea republic": "korea",
  "republic of korea": "korea",
  "czechia": "czech",
  "czech republic": "czech",
  "bosnia herzegovina": "bosnia",
  "bosniaherzegovina": "bosnia",
  "bosnia and herzegovina": "bosnia",
  "bosniaandherzegovina": "bosnia",
  "bosnia & herzegovina": "bosnia",
  "bosnia-herzegovina": "bosnia",
  "united states": "usa",
  "united states of america": "usa",
  "cape verde islands": "capeverde",
  "cape verde": "capeverde",
  "congo dr": "drcongo",
  "dr congo": "drcongo",
  "democratic republic of congo": "drcongo",
  "congo democratic republic": "drcongo",
};

/** Normaliza nome de seleção para comparação (minúsculo, sem acentos, sem pontuação, com aliases) */
export function normalizeTeamName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return TEAM_ALIASES[base] ?? base;
}

export interface H2HOdds {
  homeOdd: number;
  drawOdd: number;
  awayOdd: number;
}

/**
 * Extrai média das odds h2h de todos os bookmakers de um evento.
 * Retorna null se nenhum bookmaker tiver o mercado h2h.
 */
export function averageH2HOdds(event: OddsAPIEvent): H2HOdds | null {
  const samples: H2HOdds[] = [];

  for (const bm of event.bookmakers) {
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;

    const home = h2h.outcomes.find((o) => o.name === event.home_team);
    const away = h2h.outcomes.find((o) => o.name === event.away_team);
    const draw = h2h.outcomes.find((o) => o.name === "Draw");

    if (home && away && draw) {
      samples.push({ homeOdd: home.price, drawOdd: draw.price, awayOdd: away.price });
    }
  }

  if (samples.length === 0) return null;

  return {
    homeOdd: samples.reduce((s, o) => s + o.homeOdd, 0) / samples.length,
    drawOdd: samples.reduce((s, o) => s + o.drawOdd, 0) / samples.length,
    awayOdd: samples.reduce((s, o) => s + o.awayOdd, 0) / samples.length,
  };
}
