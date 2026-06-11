import {
  fetchWorldCupMatches,
  mapStatus,
  mapStage,
  mapGroup,
} from "@/lib/api-football/client";
import { createServiceClient } from "@/lib/supabase/service";

export async function syncFixtures(): Promise<{ synced: number }> {
  const matches = await fetchWorldCupMatches();

  if (matches.length === 0) {
    return { synced: 0 };
  }

  const supabase = createServiceClient();

  const gameRows = matches.map((m) => ({
    api_id: m.id,
    home_team: m.homeTeam.name ?? "TBD",
    away_team: m.awayTeam.name ?? "TBD",
    home_team_logo: m.homeTeam.crest ?? null,
    away_team_logo: m.awayTeam.crest ?? null,
    home_score: m.score.fullTime.home,
    away_score: m.score.fullTime.away,
    status: mapStatus(m.status),
    match_date: m.utcDate,
    stage: mapStage(m.stage),
    group_name: mapGroup(m.group),
  }));

  const { error } = await supabase
    .from("games")
    .upsert(gameRows, { onConflict: "api_id", ignoreDuplicates: false });

  if (error) throw error;

  return { synced: gameRows.length };
}
