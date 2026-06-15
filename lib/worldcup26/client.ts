import type { WC26Game, WC26GamesResponse } from "./types";

/**
 * Offset UTC de cada estádio durante o verão norte-americano (DST ativo):
 * Eastern (EDT) = -04:00 | Central (CDT) = -05:00 | Western (PDT) = -07:00
 */
export const STADIUM_UTC_OFFSETS: Record<string, string> = {
  "1":  "-06:00", // Azteca        – Mexico City   (CST, sem DST desde 2023)
  "2":  "-06:00", // Akron         – Guadalajara   (CST, sem DST desde 2023)
  "3":  "-06:00", // BBVA          – Monterrey     (CST, sem DST desde 2023)
  "4":  "-05:00", // AT&T          – Dallas        (CDT)
  "5":  "-05:00", // NRG           – Houston       (CDT)
  "6":  "-05:00", // Arrowhead     – Kansas City   (CDT)
  "7":  "-04:00", // Mercedes-Benz – Atlanta       (EDT)
  "8":  "-04:00", // Hard Rock     – Miami         (EDT)
  "9":  "-04:00", // Gillette      – Boston        (EDT)
  "10": "-04:00", // Lincoln Fin.  – Philadelphia  (EDT)
  "11": "-04:00", // MetLife       – New York/NJ   (EDT)
  "12": "-04:00", // BMO Field     – Toronto       (EDT)
  "13": "-07:00", // BC Place      – Vancouver     (PDT)
  "14": "-07:00", // Lumen Field   – Seattle       (PDT)
  "15": "-07:00", // Levi's        – San Francisco (PDT)
  "16": "-07:00", // SoFi          – Los Angeles   (PDT)
};

const BASE_URL = "https://worldcup26.ir";

async function wc26Fetch<T>(endpoint: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${process.env.WC26_JWT_TOKEN}` },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`worldcup26.ir error ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err) {
    // Retries only for transient network errors (ECONNRESET, ETIMEDOUT, etc.),
    // not for 4xx/5xx HTTP errors which are wrapped as Error above.
    const isNetworkError = err instanceof TypeError || (err as NodeJS.ErrnoException).code === "ECONNRESET";
    if (isNetworkError && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
      return wc26Fetch<T>(endpoint, attempt + 1);
    }
    throw err;
  }
}

export async function fetchAllGames(): Promise<WC26Game[]> {
  const data = await wc26Fetch<WC26GamesResponse>("/get/games");
  return data.games;
}

/** Converte time_elapsed da worldcup26.ir para o padrão interno */
export function mapStatus(timeElapsed: string): string {
  switch (timeElapsed) {
    case "notstarted":
      return "NS";
    case "halftime":
      return "HT";
    case "finished":
      return "FT";
    default:
      // Fallback defensivo: qualquer string desconhecida (1H, 2H, etc.) é LIVE
      return "LIVE";
  }
}

/** Mapeia type da worldcup26.ir para label de stage interno */
export function mapStage(type: string): string {
  const map: Record<string, string> = {
    group: "Group Stage",
    round_of_32: "Round of 32",
    round_of_16: "Round of 16",
    quarter_finals: "Quarter-finals",
    semi_finals: "Semi-finals",
    third_place: "3rd Place",
    final: "Final",
  };
  return map[type] ?? type;
}

/** Mapeia group da worldcup26.ir para label interno (ex: "A" → "Group A") */
export function mapGroup(group: string | null): string | null {
  if (!group) return null;
  return `Group ${group}`;
}

/**
 * Deriva o vencedor a partir dos placares.
 * Substitui o campo score.winner da football-data.org que a nova API não possui.
 */
export function deriveWinner(
  homeScore: string,
  awayScore: string
): "HOME" | "AWAY" | "DRAW" | null {
  const h = parseInt(homeScore, 10);
  const a = parseInt(awayScore, 10);
  if (isNaN(h) || isNaN(a)) return null;
  if (h > a) return "HOME";
  if (a > h) return "AWAY";
  return "DRAW";
}
