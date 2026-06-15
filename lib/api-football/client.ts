import type { FDMatch, FDMatchesResponse } from "./types";

const BASE_URL = "https://api.football-data.org/v4";
const WC_CODE = "WC";

async function fdFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY!,
    },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`football-data.org error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function fetchWorldCupMatches(): Promise<FDMatch[]> {
  const data = await fdFetch<FDMatchesResponse>(
    `/competitions/${WC_CODE}/matches`,
    { season: "2026" }
  );
  return data.matches;
}

export async function fetchMatchesByDate(date: string): Promise<FDMatch[]> {
  const data = await fdFetch<FDMatchesResponse>(
    `/competitions/${WC_CODE}/matches`,
    { dateFrom: date, dateTo: date }
  );
  return data.matches;
}

export async function fetchLiveMatches(): Promise<FDMatch[]> {
  // URLSearchParams encodes commas as %2C; football-data.org requires literal commas
  const url = `${BASE_URL}/competitions/${WC_CODE}/matches?status=IN_PLAY,PAUSED`;
  const res = await fetch(url, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY! },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`football-data.org error ${res.status}: ${text}`);
  }
  const data: FDMatchesResponse = await res.json();
  return data.matches;
}

/** Converte status da football-data.org para o padrão interno */
export function mapStatus(status: string): string {
  switch (status) {
    case "SCHEDULED":
    case "TIMED":
      return "NS";
    case "IN_PLAY":
      return "LIVE";
    case "PAUSED":
      return "HT";
    case "FINISHED":
      return "FT";
    default:
      return status;
  }
}

/** Mapeia stage para label legível */
export function mapStage(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    ROUND_OF_16: "Round of 16",
    QUARTER_FINALS: "Quarter-finals",
    SEMI_FINALS: "Semi-finals",
    THIRD_PLACE: "3rd Place",
    FINAL: "Final",
  };
  return map[stage] ?? stage;
}

/** Mapeia group para label legível (ex: GROUP_A → Group A) */
export function mapGroup(group: string | null): string | null {
  if (!group) return null;
  return group.replace("GROUP_", "Group ");
}

/**
 * Converte odds decimais para probabilidade implícita normalizada.
 * Normaliza para que home + draw + away = 1 (remove a margem da casa).
 */
export function oddsToProbs(
  homeOdd: number,
  drawOdd: number,
  awayOdd: number
) {
  const rawHome = 1 / homeOdd;
  const rawDraw = 1 / drawOdd;
  const rawAway = 1 / awayOdd;
  const total = rawHome + rawDraw + rawAway;
  return {
    home: rawHome / total,
    draw: rawDraw / total,
    away: rawAway / total,
  };
}
