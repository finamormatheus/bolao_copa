import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  if ((liveGames?.length ?? 0) === 0) {
    return NextResponse.json({ error: "Tournament not started" }, { status: 403 });
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

  // RLS de champion_picks permite leitura por qualquer usuário autenticado
  const { data: championPicks } = await supabase
    .from("champion_picks")
    .select("user_id, team_name, points_awarded")
    .in("user_id", userIds.length > 0 ? userIds : [""]);

  const pickByUserId = Object.fromEntries(
    (championPicks ?? []).map((cp) => [cp.user_id, cp])
  );

  const picks = (profiles ?? []).map((profile) => {
    const cp = pickByUserId[profile.id];
    return {
      display_name: profile.display_name,
      avatar_url: profile.avatar_url ?? null,
      team_name: cp?.team_name ?? null,
      points_awarded: cp?.points_awarded ?? 0,
    };
  });

  return NextResponse.json({ picks });
}
