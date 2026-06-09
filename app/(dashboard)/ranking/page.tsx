import { createClient } from "@/lib/supabase/server";
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

export const revalidate = 30;

interface RankingRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  games_played: number;
  exact_scores: number;
}

export default async function RankingPage() {
  const supabase = await createClient();

  // Agrega pontuação total por usuário
  const { data: scores } = await supabase
    .from("game_scores")
    .select("user_id, total_points, breakdown");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url");

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p])
  );

  // Agrupa por usuário
  const rankingMap: Record<string, RankingRow> = {};
  for (const score of scores ?? []) {
    if (!rankingMap[score.user_id]) {
      const profile = profileMap[score.user_id];
      rankingMap[score.user_id] = {
        user_id: score.user_id,
        display_name: profile?.display_name ?? "Usuário",
        avatar_url: profile?.avatar_url ?? null,
        total_points: 0,
        games_played: 0,
        exact_scores: 0,
      };
    }
    rankingMap[score.user_id].total_points += score.total_points ?? 0;
    rankingMap[score.user_id].games_played += 1;
    const breakdown = score.breakdown as { exact?: boolean } | null;
    if (breakdown?.exact) rankingMap[score.user_id].exact_scores += 1;
  }

  const ranking = Object.values(rankingMap).sort(
    (a, b) => b.total_points - a.total_points
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ranking</h1>

      {ranking.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Nenhum palpite pontuado ainda.</p>
          <p className="text-sm mt-1">O ranking aparece após o primeiro jogo encerrado.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Participante</TableHead>
              <TableHead className="text-right">Jogos</TableHead>
              <TableHead className="text-right">Acertos exatos</TableHead>
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
                    {row.games_played}
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
