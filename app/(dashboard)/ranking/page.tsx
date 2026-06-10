import { createClient } from "@/lib/supabase/server";
import { toSlug } from "./group-slug";
import { GroupSelector } from "./GroupSelector";
import { RankingPodium, type PodiumEntry } from "@/components/RankingPodium";
import { RankingListHeader, RankingRow, type RankRowEntry } from "@/components/RankingRow";

interface RankingEntry {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_scores: number;
  delta: number | null;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const supabase = await createClient();
  const { group: groupParam } = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? "";

  const { data: userGroups } = await supabase
    .from("groups")
    .select("id, name")
    .order("name");

  const selectedGroupId = groupParam
    ? (userGroups?.find((g) => toSlug(g.name) === groupParam)?.id ?? userGroups?.[0]?.id ?? "")
    : (userGroups?.[0]?.id ?? "");

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

  const today = new Date().toISOString().split("T")[0];

  const [{ data: scores }, { data: championPicksData }] = await Promise.all([
    supabase
      .from("game_scores")
      .select("user_id, total_points, breakdown")
      .in("user_id", groupUserIds.length > 0 ? groupUserIds : [""]),
    supabase
      .from("champion_picks")
      .select("user_id, points_awarded")
      .in("user_id", groupUserIds.length > 0 ? groupUserIds : [""]),
  ]);

  // ranking_snapshots is not yet in the generated types; cast to any until types are regenerated
  const { data: snapshots } = (await (supabase as any)
    .from("ranking_snapshots")
    .select("user_id, rank, game_day")
    .eq("group_id", selectedGroupId)
    .lt("game_day", today)
    .order("game_day", { ascending: false })) as { data: Array<{ user_id: string; rank: number; game_day: string }> | null };


  const championByUserId = Object.fromEntries(
    (championPicksData ?? []).map((cp) => [cp.user_id, cp])
  );

  // Most recent snapshot rank per user
  const prevRankByUser: Record<string, number> = {};
  for (const snap of snapshots ?? []) {
    if (!prevRankByUser[snap.user_id]) {
      prevRankByUser[snap.user_id] = snap.rank;
    }
  }

  const rankingMap: Record<string, { user_id: string; display_name: string; total_points: number; exact_scores: number }> = {};
  for (const member of groupMembers ?? []) {
    const profile = profileByEmail[member.email];
    const key = profile?.id ?? member.email;
    rankingMap[key] = {
      user_id: key,
      display_name: profile?.display_name ?? member.email.split("@")[0],
      total_points: 0,
      exact_scores: 0,
    };
  }

  for (const score of scores ?? []) {
    if (!rankingMap[score.user_id]) continue;
    rankingMap[score.user_id].total_points += score.total_points ?? 0;
    const breakdown = score.breakdown as { exact?: boolean } | null;
    if (breakdown?.exact) rankingMap[score.user_id].exact_scores += 1;
  }

  for (const [userId, cp] of Object.entries(championByUserId)) {
    if (!rankingMap[userId]) continue;
    rankingMap[userId].total_points += cp.points_awarded ?? 0;
  }

  const sorted = Object.values(rankingMap).sort((a, b) => b.total_points - a.total_points);

  const ranking: RankingEntry[] = sorted.map((row, i) => ({
    ...row,
    delta: prevRankByUser[row.user_id] !== undefined
      ? prevRankByUser[row.user_id] - (i + 1)
      : null,
  }));

  const me = ranking.find((r) => r.user_id === currentUserId);
  const myRank = me ? ranking.indexOf(me) + 1 : null;

  const podiumRows = ranking.slice(0, 3) as PodiumEntry[];
  const listRows = ranking.slice(3) as RankRowEntry[];
  const showPodium = podiumRows.length >= 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Title + "Sua posição" pill */}
      <div style={{
        marginBottom: 16, display: "flex", alignItems: "flex-end",
        justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{
            margin: "0 0 3px",
            fontSize: 30, fontWeight: 800, letterSpacing: "-0.01em",
            fontFamily: '"FWC2026", system-ui, sans-serif',
            textTransform: "uppercase",
            color: "var(--bolao-ink)",
          }}>Ranking</h1>
          <p style={{
            margin: 0, fontSize: 13.5,
            color: "var(--bolao-ink-dim)",
            fontFamily: '"Noto Sans", system-ui, sans-serif',
          }}>
            Atualizado a cada jogo · variação a cada dia de jogo
          </p>
        </div>

        {me && myRank && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 9,
            background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)",
            borderRadius: 999, padding: "7px 7px 7px 14px",
          }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--bolao-ink-faint)",
              fontFamily: '"Noto Sans", system-ui, sans-serif',
            }}>Sua posição</span>
            <span style={{
              fontSize: 14, fontWeight: 800,
              fontFamily: '"FWC2026", system-ui, sans-serif',
              fontVariantNumeric: "tabular-nums",
              color: "var(--bolao-lime)",
            }}>{myRank}º</span>
            <span style={{
              background: "var(--bolao-lime)", color: "var(--bolao-ink-dark)",
              borderRadius: 999, padding: "3px 10px 2px",
              fontSize: 13, fontWeight: 800,
              fontFamily: '"FWC2026", system-ui, sans-serif',
              fontVariantNumeric: "tabular-nums",
            }}>{me.total_points} pts</span>
          </div>
        )}
      </div>

      {/* Group tabs */}
      {userGroups && userGroups.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <GroupSelector
            groups={userGroups}
            selectedGroupId={selectedGroupId}
            currentGroupSlug={groupParam ?? null}
          />
        </div>
      )}

      {ranking.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--bolao-ink-dim)" }}>
          <p style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Nenhum participante encontrado neste grupo.</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          {showPodium && (
            <div style={{ marginBottom: 22 }}>
              <RankingPodium rows={podiumRows} currentUserId={currentUserId} />
            </div>
          )}

          {/* List (rank 4+, or rank 1+ if podium hidden) */}
          {listRows.length > 0 && (
            <>
              <RankingListHeader />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {listRows.map((row, i) => (
                  <RankingRow
                    key={row.user_id}
                    row={row}
                    rank={showPodium ? 4 + i : i + 1}
                    isCurrentUser={row.user_id === currentUserId}
                  />
                ))}
              </div>
            </>
          )}

          {/* If only 1–3 people, show all in podium only — no list needed */}
          {!showPodium && (
            <>
              <RankingListHeader />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {ranking.map((row, i) => (
                  <RankingRow
                    key={row.user_id}
                    row={row as RankRowEntry}
                    rank={i + 1}
                    isCurrentUser={row.user_id === currentUserId}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
