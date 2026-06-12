import { fetchAllGames, mapStatus, mapStage, mapGroup, STADIUM_UTC_OFFSETS } from "./client";
import { createServiceClient } from "@/lib/supabase/service";

/** Converte "MM/DD/YYYY HH:mm" + offset do estádio para ISO UTC */
function parseLocalDate(localDate: string, stadiumId: string): string {
  const offset = STADIUM_UTC_OFFSETS[stadiumId] ?? "-05:00";
  const [datePart, timePart] = localDate.split(" ");
  const [month, day, year] = datePart.split("/");
  return new Date(`${year}-${month}-${day}T${timePart}:00${offset}`).toISOString();
}

export async function syncFixtures(): Promise<{ synced: number }> {
  const games = await fetchAllGames();

  if (games.length === 0) {
    return { synced: 0 };
  }

  const supabase = createServiceClient();

  const gameRows = games
    .filter((g) => g.home_team_name_en && g.away_team_name_en)
    .map((g) => ({
    wc26_api_id: g.id,
    home_team: g.home_team_name_en,
    away_team: g.away_team_name_en,
    home_score: g.finished === "TRUE" ? parseInt(g.home_score, 10) : null,
    away_score: g.finished === "TRUE" ? parseInt(g.away_score, 10) : null,
    status: mapStatus(g.time_elapsed),
    stage: mapStage(g.type),
    group_name: mapGroup(g.group),
    match_date: parseLocalDate(g.local_date, g.stadium_id),
  }));

  const { error } = await supabase
    .from("games")
    .upsert(gameRows, { onConflict: "wc26_api_id", ignoreDuplicates: false });

  if (error) throw error;

  return { synced: gameRows.length };
}
