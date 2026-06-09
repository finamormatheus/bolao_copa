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

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .order("match_date", { ascending: true });

  const { data: odds } = await supabase.from("odds").select("*");

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", user.id);

  const { data: scores } = await supabase
    .from("game_scores")
    .select("*")
    .eq("user_id", user.id);

  return (
    <PalpitesClient
      userId={user.id}
      games={games ?? []}
      odds={odds ?? []}
      predictions={predictions ?? []}
      scores={scores ?? []}
    />
  );
}
