import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PalpitesClient from "./PalpitesClient";

export const revalidate = 60; // revalida a cada 60s

export default async function PalpitesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: games },
    { data: odds },
    { data: predictions },
    { data: scores },
    { data: championPick },
    { data: liveGames },
    { data: allGames },
  ] = await Promise.all([
    supabase.from("games").select("*").order("match_date", { ascending: true }),
    supabase.from("odds").select("*"),
    supabase.from("predictions").select("*").eq("user_id", user.id),
    supabase.from("game_scores").select("*").eq("user_id", user.id),
    supabase.from("champion_picks").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("games").select("id").neq("status", "NS").limit(1),
    supabase.from("games").select("home_team, away_team"),
  ]);

  const championLocked = (liveGames?.length ?? 0) > 0;

  const teamSet = new Set<string>();
  for (const game of allGames ?? []) {
    if (game.home_team !== "TBD") teamSet.add(game.home_team);
    if (game.away_team !== "TBD") teamSet.add(game.away_team);
  }
  const teams = Array.from(teamSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <PalpitesClient
      userId={user.id}
      games={games ?? []}
      odds={odds ?? []}
      predictions={predictions ?? []}
      scores={scores ?? []}
      championPick={championPick ?? null}
      championLocked={championLocked}
      teams={teams}
    />
  );
}
