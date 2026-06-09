import { createClient } from "@/lib/supabase/server";
import { toSlug } from "./group-slug";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GroupSelector } from "./GroupSelector";

interface RankingRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  games_played: number;
  exact_scores: number;
  champion_pts: number;
  champion_team: string | null;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const supabase = await createClient();
  const { group: groupParam } = await searchParams;

  // Todos os grupos do usuário (RLS limita aos seus grupos)
  const { data: userGroups } = await supabase
    .from("groups")
    .select("id, name")
    .order("name");

  const selectedGroupId = groupParam
    ? (userGroups?.find((g) => toSlug(g.name) === groupParam)?.id ?? userGroups?.[0]?.id ?? "")
    : (userGroups?.[0]?.id ?? "");

  // Membros do grupo selecionado
  const { data: groupMembers } = await supabase
    .from("group_members")
    .select("email")
    .eq("group_id", selectedGroupId);

  const groupEmails = groupMembers?.map((m) => m.email) ?? [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .in("email", groupEmails.length > 0 ? groupEmails : [""]);

  const profileByEmail = Object.fromEntries(
    (profiles ?? []).map((p) => [p.email, p])
  );

  const groupUserIds = (profiles ?? []).map((p) => p.id);

  const [{ data: scores }, { data: championPicksData }] = await Promise.all([
    supabase
      .from("game_scores")
      .select("user_id, total_points, breakdown")
      .in("user_id", groupUserIds.length > 0 ? groupUserIds : [""]),
    supabase
      .from("champion_picks")
      .select("user_id, team_name, points_awarded")
      .in("user_id", groupUserIds.length > 0 ? groupUserIds : [""]),
  ]);

  const championByUserId = Object.fromEntries(
    (championPicksData ?? []).map((cp) => [cp.user_id, cp])
  );

  // Inicializa todos os membros do grupo, com ou sem perfil criado
  const rankingMap: Record<string, RankingRow> = {};
  for (const member of groupMembers ?? []) {
    const profile = profileByEmail[member.email];
    const key = profile?.id ?? member.email;
    rankingMap[key] = {
      user_id: key,
      display_name: profile?.display_name ?? member.email.split("@")[0],
      avatar_url: profile?.avatar_url ?? null,
      total_points: 0,
      games_played: 0,
      exact_scores: 0,
      champion_pts: 0,
      champion_team: null,
    };
  }

  for (const score of scores ?? []) {
    if (!rankingMap[score.user_id]) continue;
    rankingMap[score.user_id].total_points += score.total_points ?? 0;
    rankingMap[score.user_id].games_played += 1;
    const breakdown = score.breakdown as { exact?: boolean } | null;
    if (breakdown?.exact) rankingMap[score.user_id].exact_scores += 1;
  }

  for (const [userId, cp] of Object.entries(championByUserId)) {
    if (!rankingMap[userId]) continue;
    rankingMap[userId].champion_pts = cp.points_awarded ?? 0;
    rankingMap[userId].champion_team = cp.team_name ?? null;
    rankingMap[userId].total_points += cp.points_awarded ?? 0;
  }

  const ranking = Object.values(rankingMap).sort(
    (a, b) => b.total_points - a.total_points
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ranking</h1>

      {userGroups && userGroups.length > 1 && (
        <GroupSelector groups={userGroups} selectedGroupId={selectedGroupId} />
      )}

      {ranking.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Nenhum participante encontrado neste grupo.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Participante</TableHead>
              <TableHead className="text-right">Jogos</TableHead>
              <TableHead className="text-right">Acertos exatos</TableHead>
              <TableHead className="text-right">Campeão</TableHead>
              <TableHead className="text-right font-bold">Pontos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((row, i) => {
              const initials = row.display_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const position = i + 1;
              const medal =
                position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : null;

              return (
                <TableRow key={row.user_id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {medal ?? position}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={row.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{row.display_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.games_played > 0 ? row.games_played : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.exact_scores > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        ⚽ {row.exact_scores}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.champion_team ? (
                      <span className="text-xs text-muted-foreground">
                        {row.champion_pts > 0 ? (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                            🏆 {row.champion_team}
                          </Badge>
                        ) : (
                          row.champion_team
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {row.total_points}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
