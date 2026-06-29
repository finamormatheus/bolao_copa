"use client";

import { useState } from "react";
import { TEAM_FLAGS } from "@/lib/translations/teams";

/* ---- types ---- */

export type GroupPickWithId = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  home_score: number | null;
  away_score: number | null;
  total_points: number | null;
  advance_pick?: string | null;
};

export type GroupedPicksData = {
  currentUserId: string;
  groups: { id: string; name: string; picks: GroupPickWithId[] }[];
};

/* ---- helpers ---- */

function outcome(h: number, a: number): "home" | "draw" | "away" {
  return h > a ? "home" : a > h ? "away" : "draw";
}

function pickOutcome(p: GroupPickWithId): "home" | "draw" | "away" | "none" {
  if (p.home_score === null || p.away_score === null) return "none";
  return p.home_score > p.away_score ? "home" : p.home_score === p.away_score ? "draw" : "away";
}

type PickSection = { label: string; picks: GroupPickWithId[] };

export function sectionedPicks(picks: GroupPickWithId[], homeTeam: string, awayTeam: string): PickSection[] {
  const home = picks
    .filter((p) => pickOutcome(p) === "home")
    .sort((a, b) => b.home_score! - a.home_score! || a.away_score! - b.away_score!);
  const draw = picks
    .filter((p) => pickOutcome(p) === "draw")
    .sort((a, b) => b.home_score! - a.home_score!);
  const away = picks
    .filter((p) => pickOutcome(p) === "away")
    .sort((a, b) => b.away_score! - a.away_score! || a.home_score! - b.home_score!);
  const none = picks.filter((p) => pickOutcome(p) === "none");
  const sections: PickSection[] = [];
  if (home.length > 0) sections.push({ label: `Apostas ${homeTeam}`, picks: home });
  if (draw.length > 0) sections.push({ label: "Apostas empate", picks: draw });
  if (away.length > 0) sections.push({ label: `Apostas ${awayTeam}`, picks: away });
  if (none.length > 0) sections.push({ label: "Sem palpite", picks: none });
  return sections;
}

/* ---- MiniFlagChip: tiny flag for advance pick indicator ---- */

function MiniFlagChip({ teamName, size = 18 }: { teamName: string; size?: number }) {
  const slug = TEAM_FLAGS[teamName] ?? null;
  const h = Math.round(size * 0.68);
  const big = Math.max(3, Math.round(size * 0.22));
  const sm = Math.max(1, Math.round(size * 0.06));
  const src = slug ? `/flags/regular/${slug}.png` : null;
  return (
    <span style={{
      width: size, height: h,
      borderRadius: `${big}px ${sm}px ${big}px ${sm}px`,
      overflow: "hidden", flexShrink: 0, display: "inline-block",
      border: "1.2px solid rgba(247,247,248,0.7)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
      background: "var(--bolao-surface-3)",
    }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={teamName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
      ) : (
        <span style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 7, fontWeight: 800, color: "var(--bolao-ink-dim)",
        }}>
          {teamName.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/* ---- PickRow ---- */

export function PickRow({
  p, currentUserId, actualOutcome, isFinished, homeScore, awayScore, homeTeam, awayTeam,
}: {
  p: GroupPickWithId;
  currentUserId: string;
  actualOutcome: "home" | "draw" | "away" | null;
  isFinished: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: string;
  awayTeam: string;
}) {
  const initials = p.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const hasGuess = p.home_score !== null && p.away_score !== null;
  const correct = actualOutcome && hasGuess ? outcome(p.home_score!, p.away_score!) === actualOutcome : false;
  const exact = correct && isFinished ? p.home_score === homeScore && p.away_score === awayScore : false;
  const showPts = isFinished && p.total_points !== null;
  const isMe = p.user_id === currentUserId;

  // Show a mini-flag of the team the person chose to advance when they predicted a draw
  const isDrawPick = hasGuess && p.home_score === p.away_score;
  const advTeamName = isDrawPick && p.advance_pick
    ? (p.advance_pick === "home" ? homeTeam : awayTeam)
    : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      borderRadius: 8, padding: "4px 0",
      opacity: isMe ? 1 : 0.85,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 99, flexShrink: 0,
          background: isMe ? "var(--bolao-lime)" : "var(--bolao-surface-2)",
          color: isMe ? "var(--bolao-ink-dark)" : "var(--bolao-ink)",
          fontSize: 9.5, fontWeight: 800, fontFamily: '"FWC2026", system-ui, sans-serif',
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{initials}</span>
        <span style={{
          fontSize: 13,
          color: isMe ? "var(--bolao-ink)" : "var(--bolao-ink-dim)",
          fontWeight: isMe ? 700 : 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          fontFamily: '"Noto Sans", system-ui, sans-serif',
        }}>{p.display_name}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {showPts && (
          <span style={{
            fontFamily: '"FWC2026", system-ui, sans-serif',
            fontSize: 11.5, fontWeight: 800, fontVariantNumeric: "tabular-nums",
            color: p.total_points! > 0 ? "#FFB300" : "var(--bolao-ink-faint)",
          }}>
            {p.total_points! > 0 ? `+${p.total_points}` : "0"}
          </span>
        )}
        {advTeamName && <MiniFlagChip teamName={advTeamName} size={18} />}
        <span style={{
          fontFamily: '"FWC2026", system-ui, sans-serif',
          fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums",
          color: exact ? "var(--bolao-green-win)" : correct ? "var(--bolao-lime)" : "var(--bolao-ink-dim)",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          {exact && <span style={{ fontSize: 11 }}>🎯</span>}
          {hasGuess ? `${p.home_score}–${p.away_score}` : "—"}
        </span>
      </span>
    </div>
  );
}

/* ---- GroupReveal ---- */

export function GroupReveal({ gameId, homeTeam, awayTeam, homeScore, awayScore, isFinished }: {
  gameId: string; homeTeam: string; awayTeam: string;
  homeScore: number | null; awayScore: number | null; isFinished: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<GroupedPicksData | "loading" | "error" | null>(null);

  async function handleToggle() {
    const wasOpen = open;
    setOpen((v) => !v);
    if (!wasOpen && (data === null || data === "error")) {
      setData("loading");
      try {
        const res = await fetch(`/api/game-picks?gameId=${gameId}`);
        const json = await res.json();
        setData(res.ok ? json : "error");
      } catch {
        setData("error");
      }
    }
  }

  const actualOutcome = isFinished && homeScore !== null && awayScore !== null
    ? outcome(homeScore, awayScore) : null;

  const isLoading = data === "loading";
  const isError = data === "error";
  const isEmpty = !isLoading && !isError && (
    data === null || (data as GroupedPicksData).groups.every((g) => g.picks.length === 0)
  );
  const multiGroup = data !== "loading" && data !== null && data !== "error"
    && (data as GroupedPicksData).groups.length > 1;

  return (
    <div style={{ borderTop: "1px solid var(--bolao-hairline)", paddingTop: 10 }}>
      <button onClick={handleToggle} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "none", border: "none", color: "var(--bolao-ink-dim)", padding: "2px 0",
        fontSize: 12.5, fontFamily: '"Noto Sans", system-ui, sans-serif', fontWeight: 600,
        cursor: "pointer",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
          {isLoading ? (
            <span style={{
              width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
              border: "2px solid currentColor", borderTopColor: "transparent",
              display: "inline-block", animation: "bolao-spin 0.6s linear infinite",
            }} />
          ) : (
            <span style={{ fontSize: 13 }}>👥</span>
          )}
          Palpites do grupo
        </span>
        <span style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 0 }}>
          {isLoading ? (
            <p style={{ fontSize: 12, color: "var(--bolao-ink-faint)", margin: 0 }}>Carregando...</p>
          ) : isError ? (
            <p style={{ fontSize: 12, color: "var(--bolao-ink-faint)", margin: 0 }}>Erro ao carregar palpites. Tente novamente.</p>
          ) : isEmpty ? (
            <p style={{ fontSize: 12, color: "var(--bolao-ink-faint)", margin: 0 }}>Nenhum palpite encontrado.</p>
          ) : (
            (data as GroupedPicksData).groups.map((group, gi) => (
              <div key={group.id}>
                {multiGroup && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    marginTop: gi > 0 ? 12 : 0, marginBottom: 6,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                      letterSpacing: "0.07em", color: "var(--bolao-ink-faint)",
                      fontFamily: '"FWC2026", system-ui, sans-serif',
                      whiteSpace: "nowrap",
                    }}>{group.name}</span>
                    <span style={{ flex: 1, height: 1, background: "var(--bolao-hairline)" }} />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {sectionedPicks(group.picks, homeTeam, awayTeam).map((section, si) => (
                    <div key={si}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        marginTop: si > 0 ? 10 : 0, marginBottom: 4,
                      }}>
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.06em", color: "var(--bolao-ink-faint)",
                          fontFamily: '"Noto Sans", system-ui, sans-serif',
                          whiteSpace: "nowrap",
                        }}>{section.label}</span>
                        <span style={{ flex: 1, height: 1, background: "var(--bolao-hairline)" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {section.picks.map((p) => (
                          <PickRow
                            key={p.user_id}
                            p={p}
                            currentUserId={(data as GroupedPicksData).currentUserId}
                            actualOutcome={actualOutcome}
                            isFinished={isFinished}
                            homeScore={homeScore}
                            awayScore={awayScore}
                            homeTeam={homeTeam}
                            awayTeam={awayTeam}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
