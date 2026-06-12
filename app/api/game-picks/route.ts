import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const LOCK_MINUTES = 5;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "Missing gameId" }, { status: 400 });

  const { data: game } = await supabase
    .from("games")
    .select("match_date, status")
    .eq("id", gameId)
    .single();

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const isLiveOrFinished = ["LIVE", "HT", "FT", "AET", "PEN", "FINISHED"].includes(game.status ?? "");
  const diff = new Date(game.match_date).getTime() - Date.now();
  if (!isLiveOrFinished && diff > LOCK_MINUTES * 60 * 1000) {
    return NextResponse.json({ error: "Game not locked yet" }, { status: 403 });
  }

  // RLS retorna apenas os grupos do usuário autenticado
  const { data: userGroups } = await supabase.from("groups").select("id");
  const groupIds = (userGroups ?? []).map((g) => g.id);

  if (groupIds.length === 0) return NextResponse.json({ picks: [] });

  const { data: allMembers } = await supabase
    .from("group_members")
    .select("email")
    .in("group_id", groupIds);

  const allEmails = [...new Set((allMembers ?? []).map((m) => m.email))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("email", allEmails.length > 0 ? allEmails : [""]);

  const userIds = (profiles ?? []).map((p) => p.id);

  // Service role necessário — RLS de predictions restringe leitura ao próprio usuário
  const serviceClient = createServiceClient();
  const [{ data: predictions }, { data: scores }] = await Promise.all([
    serviceClient
      .from("predictions")
      .select("user_id, home_score, away_score")
      .eq("game_id", gameId)
      .in("user_id", userIds.length > 0 ? userIds : [""]),
    serviceClient
      .from("game_scores")
      .select("user_id, total_points")
      .eq("game_id", gameId)
      .in("user_id", userIds.length > 0 ? userIds : [""]),
  ]);

  const predByUserId = Object.fromEntries(
    (predictions ?? []).map((p) => [p.user_id, p])
  );
  const scoreByUserId = Object.fromEntries(
    (scores ?? []).map((s) => [s.user_id, s])
  );

  const picks = (profiles ?? []).map((profile) => {
    const pred = predByUserId[profile.id];
    const score = scoreByUserId[profile.id];
    return {
      display_name: profile.display_name,
      avatar_url: profile.avatar_url ?? null,
      home_score: pred?.home_score ?? null,
      away_score: pred?.away_score ?? null,
      total_points: score?.total_points ?? null,
    };
  });

  return NextResponse.json({ picks });
}
