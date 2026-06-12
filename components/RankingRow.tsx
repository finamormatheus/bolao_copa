export interface RankRowEntry {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_scores: number;
  delta: number | null;
  livePoints?: number;
}

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

function LiveBadge({ pts }: { pts: number }) {
  if (!pts) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: "rgba(255,22,68,0.1)",
      color: "var(--bolao-red)",
      border: "1px solid rgba(255,22,68,0.22)",
      borderRadius: 999, padding: "2px 7px 1px",
      fontSize: 11, fontWeight: 800,
      fontFamily: '"FWC2026", system-ui, sans-serif',
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "0.02em",
    }}>+{pts}</span>
  );
}

function ExactBadge({ exact }: { exact: number }) {
  if (!exact) return <span style={{ color: "var(--bolao-ink-faint)", fontSize: 13 }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "var(--bolao-lime-soft)",
      color: "var(--bolao-lime)",
      border: "1px solid rgba(173,235,3,0.30)",
      borderRadius: 999, padding: "3px 9px 2px",
      fontSize: 12, fontWeight: 800, letterSpacing: "0.02em",
      fontFamily: '"FWC2026", system-ui, sans-serif',
      textTransform: "uppercase",
      fontVariantNumeric: "tabular-nums",
    }}>
      <span style={{ fontSize: 11 }}>🎯</span>{exact}
    </span>
  );
}

export function RankingListHeader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 16px 0 14px", marginBottom: 2,
    }}>
      <span style={{ width: 30, flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--bolao-ink-faint)",
        fontFamily: '"Noto Sans", system-ui, sans-serif',
      }}>Participante</span>
      <span className="hide-sm" style={{
        width: 54, textAlign: "center", fontSize: 10, fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--bolao-ink-faint)",
        fontFamily: '"Noto Sans", system-ui, sans-serif',
      }}>Cravadas</span>
      <span
        className="hide-sm"
        title="Variação de posição a cada dia de jogo"
        style={{
          width: 34, textAlign: "center", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase",
          color: "var(--bolao-ink-faint)",
          fontFamily: '"Noto Sans", system-ui, sans-serif',
          cursor: "help", marginRight: 8,
        }}
      >Var.</span>
      <span style={{
        width: 64, textAlign: "right", fontSize: 10, fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--bolao-ink-faint)",
        fontFamily: '"Noto Sans", system-ui, sans-serif',
      }}>Pontos</span>
    </div>
  );
}

export function RankingRow({ row, rank, isCurrentUser }: {
  row: RankRowEntry;
  rank: number;
  isCurrentUser: boolean;
}) {
  const exact = row.exact_scores;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px 12px 11px",
      borderRadius: 16,
      background: isCurrentUser ? "var(--bolao-lime-soft)" : "var(--bolao-surface)",
      borderLeft: isCurrentUser ? "3px solid var(--bolao-lime)" : "3px solid transparent",
      boxShadow: isCurrentUser ? "none" : "0 1px 0 rgba(247,247,248,0.03)",
    }}>
      <span style={{
        width: 30, flexShrink: 0, textAlign: "center",
        fontSize: 17, fontWeight: 800,
        fontFamily: '"FWC2026", system-ui, sans-serif',
        fontVariantNumeric: "tabular-nums",
        color: isCurrentUser ? "var(--bolao-lime)" : "var(--bolao-ink-dim)",
      }}>{rank}</span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 99, flexShrink: 0,
          background: isCurrentUser ? "var(--bolao-lime)" : "var(--bolao-surface-2)",
          color: isCurrentUser ? "var(--bolao-ink-dark)" : "var(--bolao-ink)",
          fontSize: 12.5, fontWeight: 800,
          fontFamily: '"FWC2026", system-ui, sans-serif',
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{initials(row.display_name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="rank-name"
            style={{ color: isCurrentUser ? "var(--bolao-lime)" : "var(--bolao-ink)" }}
          >{row.display_name}</div>
          {/* mobile-only: cravadas + variação collapse under the name so nothing crowds the points */}
          <div className="rank-meta">
            <ExactBadge exact={exact} />
            <span className="rank-meta-sep" />
            <Delta delta={row.delta} />
          </div>
        </div>
      </div>

      {/* Cravadas — hidden on phones (≤480px), visible above */}
      <span className="hide-sm" style={{ width: 54, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <ExactBadge exact={exact} />
      </span>

      {/* Variação — hidden on phones (≤480px), visible above */}
      <span className="hide-sm" style={{ width: 34, display: "flex", justifyContent: "center", flexShrink: 0, marginRight: 8 }}>
        <Delta delta={row.delta} />
      </span>

      <div style={{
        width: 64, flexShrink: 0,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{
            fontSize: 21, fontWeight: 800,
            fontFamily: '"FWC2026", system-ui, sans-serif',
            fontVariantNumeric: "tabular-nums",
            color: isCurrentUser ? "var(--bolao-lime)" : "var(--bolao-ink)",
          }}>{row.total_points}</span>
          <span style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em",
            fontFamily: '"FWC2026", system-ui, sans-serif',
            textTransform: "uppercase",
            color: "var(--bolao-ink-faint)",
          }}>pts</span>
        </div>
        <LiveBadge pts={row.livePoints ?? 0} />
      </div>
    </div>
  );
}
