import { fetchAllGames, mapStatus, mapStage, mapGroup, STADIUM_UTC_OFFSETS } from "./client";
import { createServiceClient } from "@/lib/supabase/service";

/** Converte "MM/DD/YYYY HH:mm" + offset do estádio para ISO UTC */
function parseLocalDate(localDate: string, stadiumId: string): string {
  const offset = STADIUM_UTC_OFFSETS[stadiumId] ?? "-05:00";
  const [datePart, timePart] = localDate.split(" ");
  const [month, day, year] = datePart.split("/");
  return new Date(`${year}-${month}-${day}T${timePart}:00${offset}`).toISOString();
}

// WC26 API reports wrong kickoff times for these games; correct values verified manually via football-data.org
// Keys are WC26 game IDs (g.id). FD match ID noted for reference.
const MATCH_DATE_OVERRIDES: Record<string, string> = {
  "29": "2026-06-20T00:30:00.000Z", // Brazil x Haiti — FD id 537341
};

const parseScore = (s: string): number | null => { const n = parseInt(s, 10); return isNaN(n) ? null : n; };

export async function syncFixtures(): Promise<{ synced: number }> {
  const games = await fetchAllGames();

  if (games.length === 0) {
    return { synced: 0 };
  }

  const supabase = createServiceClient();

  const gameRows = games
    .filter((g) => g.local_date)
    .map((g) => {
      const parsedHome = parseScore(g.home_score);
      const parsedAway = parseScore(g.away_score);
      // Only include scores in the upsert when the API returns a valid pair.
      // Omitting them entirely (instead of writing null) means an API glitch or lag
      // on a live/just-finished game can never wipe a score that's already in the DB.
      const scoreFields =
        parsedHome !== null && parsedAway !== null
          ? { home_score: parsedHome, away_score: parsedAway }
          : {};
      const match_date = MATCH_DATE_OVERRIDES[g.id] ?? parseLocalDate(g.local_date, g.stadium_id);
      return {
        wc26_api_id: g.id,
        home_team: g.home_team_name_en || "A definir",
        away_team: g.away_team_name_en || "A definir",
        ...scoreFields,
        status: mapStatus(g.time_elapsed),
        stage: mapStage(g.type),
        group_name: mapGroup(g.group),
        match_date,
      };
    });

  const { error } = await supabase
    .from("games")
    .upsert(gameRows, { onConflict: "wc26_api_id", ignoreDuplicates: false });

  if (error) throw error;

  return { synced: gameRows.length };
}
