import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pickResult, lockResult, gamesResult] = await Promise.all([
    supabase
      .from("champion_picks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("games").select("id").neq("status", "NS").limit(1),
    supabase.from("games").select("home_team, away_team"),
  ]);

  const locked = (lockResult.data?.length ?? 0) > 0;

  const teamSet = new Set<string>();
  for (const game of gamesResult.data ?? []) {
    if (game.home_team !== "TBD") teamSet.add(game.home_team);
    if (game.away_team !== "TBD") teamSet.add(game.away_team);
  }
  const teams = Array.from(teamSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return NextResponse.json({ pick: pickResult.data ?? null, locked, teams });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: liveGames } = await supabase
    .from("games")
    .select("id")
    .neq("status", "NS")
    .limit(1);

  if ((liveGames?.length ?? 0) > 0) {
    return NextResponse.json({ error: "Tournament has started" }, { status: 403 });
  }

  const body = await request.json();
  const team_name = typeof body?.team_name === "string" ? body.team_name.trim() : "";
  if (!team_name) {
    return NextResponse.json({ error: "Invalid team_name" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("champion_picks")
    .upsert({ user_id: user.id, team_name }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pick: data });
}
