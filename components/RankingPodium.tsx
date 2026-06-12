export interface PodiumEntry {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_scores: number;
  delta: number | null;
  livePoints?: number;
}

function LiveBadge({ pts }: { pts: number }) {
  if (!pts) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: "rgba(255,22,68,0.1)",
      color: "var(--bolao-red)",
      border: "1px solid rgba(255,22,68,0.22)",
      borderRadius: 999, padding: "2px 8px 1px",
      fontSize: 11, fontWeight: 800,
      fontFamily: '"FWC2026", system-ui, sans-serif',
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "0.02em",
    }}>+{pts}</span>
  );
}

const MEDAL: Record<1 | 2 | 3, { color: string; soft: string; plinth: number }> = {
  1: { color: "rgb(232,163,14)",   soft: "rgba(232,163,14,0.14)",  plinth: 104 },
  2: { color: "rgb(196,201,214)",  soft: "rgba(196,201,214,0.12)", plinth: 78  },
  3: { color: "rgb(201,131,74)",   soft: "rgba(201,131,74,0.14)",  plinth: 58  },
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function Delta({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        fontSize: 12.5, fontWeight: 800,
        fontFamily: '"FWC2026", system-ui, sans-serif',
        fontVariantNumeric: "tabular-nums",
        color: "var(--bolao-ink-faint)",
      }}>–</span>
    );
  }
  const up = delta > 0;
  return (
    <span
      title={up ? `Subiu ${delta} no último dia de jogo` : `Caiu ${-delta} no último dia de jogo`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 2,
        fontSize: 12.5, fontWeight: 800,
        fontFamily: '"FWC2026", system-ui, sans-serif',
        fontVariantNumeric: "tabular-nums",
        color: up ? "var(--bolao-green-win)" : "var(--bolao-red)",
      }}
    >
      <span style={{ fontSize: 9, lineHeight: 1, transform: "translateY(-0.5px)" }}>
        {up ? "▲" : "▼"}
      </span>
      {Math.abs(delta)}
    </span>
  );
}

function PodiumColumn({ row, rank, isCurrentUser }: {
  row: PodiumEntry;
  rank: 1 | 2 | 3;
  isCurrentUser: boolean;
}) {
  const m = MEDAL[rank];
  const isFirst = rank === 1;
  const size = isFirst ? 60 : 50;

  return (
    <div style={{
      flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-end",
    }}>
      {isFirst && (
        <span style={{
          width: 26, height: 44, marginBottom: 4, display: "block",
          backgroundImage: "url('/trophy.png')",
          backgroundSize: "auto 100%", backgroundPosition: "center", backgroundRepeat: "no-repeat",
          filter: "drop-shadow(0 3px 8px rgba(232,163,14,0.45))",
        }} role="img" aria-label="Líder" />
      )}

      <span style={{
        width: size, height: size, borderRadius: 99, flexShrink: 0,
        background: isCurrentUser ? "var(--bolao-lime)" : "var(--bolao-surface-2)",
        color: isCurrentUser ? "var(--bolao-ink-dark)" : "var(--bolao-ink)",
        fontSize: size * 0.33, fontWeight: 800,
        fontFamily: '"FWC2026", system-ui, sans-serif',
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 0 2px var(--bolao-bg), 0 0 0 4px ${m.color}`,
      }}>{initials(row.display_name)}</span>

      <div style={{
        marginTop: 9,
        fontSize: isFirst ? 15 : 13.5, fontWeight: 800, letterSpacing: "0.01em",
        fontFamily: '"FWC2026", system-ui, sans-serif',
        textTransform: "uppercase",
        color: isCurrentUser ? "var(--bolao-lime)" : "var(--bolao-ink)",
        textAlign: "center",
        maxWidth: "100%", overflow: "hidden",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        wordBreak: "normal", overflowWrap: "break-word", lineHeight: 1.12,
        minHeight: `${Math.round((isFirst ? 15 : 13.5) * 1.12 * 2)}px`,
      }}>{row.display_name}</div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 2 }}>
        <span style={{
          fontSize: isFirst ? 30 : 25, fontWeight: 800, lineHeight: 1,
          fontFamily: '"FWC2026", system-ui, sans-serif',
          fontVariantNumeric: "tabular-nums",
          color: "var(--bolao-lime)",
        }}>{row.total_points}</span>
        <span style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em",
          fontFamily: '"FWC2026", system-ui, sans-serif',
          textTransform: "uppercase",
          color: "var(--bolao-ink-faint)",
        }}>pts</span>
      </div>
      {(row.livePoints ?? 0) > 0 && (
        <div style={{ marginTop: 4 }}>
          <LiveBadge pts={row.livePoints!} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 6, marginBottom: 11 }}>
        <span style={{
          fontSize: 11.5, fontWeight: 700,
          color: "var(--bolao-ink-dim)",
          display: "inline-flex", alignItems: "center", gap: 4,
          fontFamily: '"FWC2026", system-ui, sans-serif',
          fontVariantNumeric: "tabular-nums",
        }}>
          <span style={{ fontSize: 10 }}>🎯</span>{row.exact_scores}
        </span>
        <span style={{ width: 1, height: 11, background: "var(--bolao-hairline-2)", display: "inline-block" }} />
        <Delta delta={row.delta} />
      </div>

      <div style={{
        width: "100%", height: m.plinth, borderRadius: "14px 14px 0 0",
        background: isFirst
          ? "linear-gradient(180deg, rgba(232,163,14,0.16), rgba(232,163,14,0.02))"
          : "linear-gradient(180deg, rgba(247,247,248,0.07), rgba(247,247,248,0.015))",
        border: `1px solid ${m.soft}`, borderBottom: "none",
        boxShadow: `inset 0 2px 0 ${m.color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontSize: isFirst ? 46 : 38, fontWeight: 800, lineHeight: 1,
          fontFamily: '"FWC2026", system-ui, sans-serif',
          fontVariantNumeric: "tabular-nums",
          color: m.color, opacity: 0.92,
        }}>{rank}</span>
      </div>
    </div>
  );
}

export function RankingPodium({ rows, currentUserId }: {
  rows: PodiumEntry[];
  currentUserId: string;
}) {
  const [first, second, third] = rows;
  return (
    <div style={{
      borderRadius: "var(--bolao-radius-card)",
      background: "linear-gradient(180deg, rgba(173,235,3,0.05), rgba(173,235,3,0) 42%), var(--bolao-surface)",
      border: "1px solid var(--bolao-hairline)",
      boxShadow: "0 12px 30px -18px rgba(0,0,0,0.8)",
      padding: "22px 16px 0", overflow: "hidden",
    }}>
      <div style={{
        textAlign: "center", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.14em",
        fontFamily: '"FWC2026", system-ui, sans-serif',
        textTransform: "uppercase",
        color: "var(--bolao-ink-faint)", marginBottom: 4,
      }}>Pódio do bolão</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        {second && <PodiumColumn row={second} rank={2} isCurrentUser={second.user_id === currentUserId} />}
        {first  && <PodiumColumn row={first}  rank={1} isCurrentUser={first.user_id  === currentUserId} />}
        {third  && <PodiumColumn row={third}  rank={3} isCurrentUser={third.user_id  === currentUserId} />}
      </div>
    </div>
  );
}
