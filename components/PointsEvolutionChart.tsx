"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

export interface DayPoint {
  game_day: string;
  points: number;
  rank: number;
}

export interface GamePoint {
  game_id: string;
  label: string;
  match_date: string;
  points: number;
  roundName: string;
}

export interface UserSeries {
  user_id: string;
  display_name: string;
  isCurrentUser: boolean;
  dayPoints: DayPoint[];
  gamePoints: GamePoint[];
}

const LIME = "#ade303";
const PALETTE = [
  "#ff1744", // vivid red
  "#ff9100", // amber
  "#2979ff", // blue
  "#00bfa5", // teal
  "#d500f9", // purple
  "#f50057", // hot pink
  "#00b0ff", // sky blue
  "#e040fb", // lavender
  "#ff6d00", // deep orange
  "#651fff", // deep purple
  "#1de9b6", // mint
  "#ff4081", // pink
];

function capitalizeName(name: string): string {
  return name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatDay(gameDay: string): string {
  const [, month, day] = gameDay.split("-");
  return `${day}/${month}`;
}

type ChartRow = Record<string, string | number>;

function buildChartData(
  series: UserSeries[],
  view: "day" | "game",
  yMode: "points" | "rank"
): ChartRow[] {
  if (series.length === 0) return [];

  if (view === "day") {
    const allDays = [...new Set(series.flatMap(s => s.dayPoints.map(p => p.game_day)))].sort();
    return allDays.map(day => {
      const row: ChartRow = { xKey: day, label: formatDay(day) };
      for (const s of series) {
        const pt = s.dayPoints.find(p => p.game_day === day);
        const prev = [...s.dayPoints].reverse().find(p => p.game_day < day);
        if (yMode === "points") {
          row[s.user_id] = pt?.points ?? prev?.points ?? 0;
        } else {
          row[s.user_id] = pt?.rank ?? prev?.rank ?? series.length;
        }
      }
      return row;
    });
  }

  // "game" view — ordered by match_date
  const allPts = series.flatMap(s => s.gamePoints);
  const allGameIds = [...new Set(allPts.map(p => p.game_id))].sort((a, b) => {
    const dA = allPts.find(p => p.game_id === a)?.match_date ?? "";
    const dB = allPts.find(p => p.game_id === b)?.match_date ?? "";
    return dA.localeCompare(dB);
  });

  const pointsRows = allGameIds.map((gameId, idx) => {
    const anyPoint = allPts.find(p => p.game_id === gameId);
    const row: ChartRow = { xKey: gameId, label: anyPoint?.label ?? `J${idx + 1}` };
    for (const s of series) {
      const pt = s.gamePoints.find(p => p.game_id === gameId);
      if (pt) {
        row[s.user_id] = pt.points;
      } else {
        const prev = [...s.gamePoints]
          .reverse()
          .find(p => p.match_date < (anyPoint?.match_date ?? ""));
        row[s.user_id] = prev?.points ?? 0;
      }
    }
    return row;
  });

  if (yMode === "points") return pointsRows;

  // Derive rank from cumulative points at each game tick
  return pointsRows.map(row => {
    const rankRow: ChartRow = { xKey: row.xKey, label: row.label };
    const sorted = series
      .map(s => ({ uid: s.user_id, pts: (row[s.user_id] as number) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    sorted.forEach((u, i) => { rankRow[u.uid] = i + 1; });
    return rankRow;
  });
}

function TogglePill({
  options, value, onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{
      display: "flex", padding: 3, gap: 3, borderRadius: 13,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid var(--bolao-hairline)",
    }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              border: "none", borderRadius: 10, padding: "6px 14px",
              fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em",
              textTransform: "uppercase" as const,
              fontFamily: '"FWC2026", system-ui, sans-serif',
              background: active ? "var(--bolao-lime)" : "transparent",
              color: active ? "var(--bolao-ink-dark)" : "var(--bolao-ink-dim)",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
              whiteSpace: "nowrap" as const,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CustomTooltip({
  active, payload, label, yMode,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  yMode: "points" | "rank";
}) {
  if (!active || !payload?.length) return null;
  const sorted = yMode === "rank"
    ? [...payload].sort((a, b) => a.value - b.value)
    : [...payload].sort((a, b) => b.value - a.value);
  return (
    <div style={{
      background: "rgba(18,18,30,0.97)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", color: "rgba(247,247,248,0.4)",
        marginBottom: 8, fontFamily: '"FWC2026", system-ui, sans-serif',
      }}>{label}</div>
      {sorted.map(entry => (
        <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, flexShrink: 0 }} />
          <span style={{
            fontSize: 12.5, color: "rgba(247,247,248,0.7)",
            fontFamily: '"Noto Sans", system-ui, sans-serif', flex: 1,
          }}>{entry.name}</span>
          <span style={{
            fontSize: 13, fontWeight: 800, color: "rgba(247,247,248,0.95)",
            fontFamily: '"FWC2026", system-ui, sans-serif', fontVariantNumeric: "tabular-nums",
          }}>
            {yMode === "rank" ? `${entry.value}º` : `${entry.value} pts`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PointsEvolutionChart({ series }: { series: UserSeries[] }) {
  const [view, setView] = useState<"day" | "game">("day");
  const [yMode, setYMode] = useState<"points" | "rank">("rank");
  const [highlightedUser, setHighlightedUser] = useState<string | null>(
    () => series.find(s => s.isCurrentUser)?.user_id ?? null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(
    () => buildChartData(series, view, yMode),
    [series, view, yMode]
  );

  // Compute round boundary markers for "por jogo" view
  const roundMarkers = useMemo(() => {
    if (view !== "game" || data.length === 0) return [];
    const allPts = series.flatMap(s => s.gamePoints);
    const sortedIds = [...new Set(allPts.map(p => p.game_id))].sort((a, b) => {
      const dA = allPts.find(p => p.game_id === a)?.match_date ?? "";
      const dB = allPts.find(p => p.game_id === b)?.match_date ?? "";
      return dA.localeCompare(dB);
    });
    const markers: Array<{ xLabel: string; roundName: string }> = [];
    let currentRound = "";
    sortedIds.forEach((gameId, idx) => {
      const roundName = allPts.find(p => p.game_id === gameId)?.roundName ?? "";
      if (roundName !== currentRound) {
        currentRound = roundName;
        const xLabel = data[idx]?.label as string | undefined;
        if (xLabel) markers.push({ xLabel, roundName });
      }
    });
    return markers;
  }, [series, view, data]);

  if (series.length === 0 || data.length < 2) return null;

  // Assign colors: current user always gets lime
  let paletteIdx = 0;
  const colorMap: Record<string, string> = {};
  for (const s of series) {
    colorMap[s.user_id] = s.isCurrentUser ? LIME : PALETTE[paletteIdx++ % PALETTE.length];
  }

  const isHighlighting = highlightedUser !== null;

  // ~38px per label is enough for "DD/MM"; skip ticks so they don't crowd on narrow screens
  const dayTickInterval = view === "day"
    ? Math.max(0, Math.ceil(data.length / Math.max(1, Math.floor(containerWidth / 38))) - 1)
    : 0;

  return (
    <div ref={containerRef} style={{
      marginTop: 32,
      borderRadius: "var(--bolao-radius-card)",
      background: "var(--bolao-surface)",
      border: "1px solid var(--bolao-hairline)",
      boxShadow: "0 12px 30px -18px rgba(0,0,0,0.8)",
      padding: "20px 16px 16px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16, gap: 10, flexWrap: "wrap",
      }}>
        <span style={{
          fontSize: 11.5, fontWeight: 800, letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontFamily: '"FWC2026", system-ui, sans-serif',
          color: "var(--bolao-ink-faint)",
        }}>
          {yMode === "points" ? "Evolução de pontos" : "Evolução de ranking"}
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <TogglePill
            options={[
              { value: "rank", label: "Ranking" },
              { value: "points", label: "Pontos" },
            ]}
            value={yMode}
            onChange={v => setYMode(v as "points" | "rank")}
          />
          <TogglePill
            options={[
              { value: "day", label: "Por dia" },
              { value: "game", label: "Por jogo" },
            ]}
            value={view}
            onChange={v => setView(v as "day" | "game")}
          />
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={dayTickInterval}
            minTickGap={view === "game" ? 0 : 2}
            height={view === "game" ? 28 : 30}
            ticks={view === "game" ? roundMarkers.map(m => m.xLabel) : undefined}
            tick={view === "game"
              ? (props: any) => {
                  const marker = roundMarkers.find(m => m.xLabel === props.payload?.value);
                  if (!marker) return <g />;
                  return (
                    <g transform={`translate(${props.x},${props.y})`}>
                      <text
                        x={4} y={0} dy={12}
                        textAnchor="start"
                        fill="rgba(247,247,248,0.45)"
                        fontSize={9.5}
                        fontFamily='"FWC2026", system-ui, sans-serif'
                        fontWeight={800}
                      >
                        {marker.roundName}
                      </text>
                    </g>
                  );
                }
              : { fill: "rgba(247,247,248,0.35)", fontSize: 10.5 }
            }
          />
          <YAxis
            tick={{ fill: "rgba(247,247,248,0.35)", fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            width={44}
            interval={0}
            reversed={yMode === "rank"}
            domain={yMode === "rank" ? [1, series.length] : ["auto", "auto"]}
            tickFormatter={v => yMode === "rank" ? `${v}º` : `${v}`}
            ticks={yMode === "rank"
              ? Array.from({ length: series.length }, (_, i) => i + 1)
              : undefined
            }
          />
          <Tooltip
            content={<CustomTooltip yMode={yMode} />}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
          />
          {view === "game" && roundMarkers.map(m => (
            <ReferenceLine
              key={m.roundName}
              x={m.xLabel}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
            />
          ))}
          {series.map(s => {
            const highlighted = !isHighlighting || highlightedUser === s.user_id;
            return (
              <Line
                key={s.user_id}
                type="monotone"
                dataKey={s.user_id}
                name={capitalizeName(s.display_name)}
                stroke={colorMap[s.user_id]}
                strokeWidth={highlighted ? (highlightedUser === s.user_id || s.isCurrentUser ? 3 : 1.5) : 1}
                strokeOpacity={highlighted ? 1 : 0.12}
                dot={false}
                activeDot={highlighted ? { r: 4, strokeWidth: 0 } : false}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{
        marginTop: 12, paddingTop: 12,
        borderTop: "1px solid var(--bolao-hairline)",
      }}>
        {isHighlighting && (
          <button
            onClick={() => setHighlightedUser(null)}
            style={{
              border: "1px solid var(--bolao-hairline)",
              borderRadius: 8, padding: "3px 10px",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
              textTransform: "uppercase" as const,
              fontFamily: '"FWC2026", system-ui, sans-serif',
              background: "transparent",
              color: "var(--bolao-ink-dim)",
              cursor: "pointer",
              marginBottom: 10,
              display: "block",
            }}
          >
            Mostrar todos
          </button>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          {series.map(s => {
            const highlighted = !isHighlighting || highlightedUser === s.user_id;
            const isSelected = highlightedUser === s.user_id;
            return (
              <button
                key={s.user_id}
                onClick={() => setHighlightedUser(isSelected ? null : s.user_id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  border: "none", background: "none", padding: 0, cursor: "pointer",
                  opacity: highlighted ? 1 : 0.35,
                  transition: "opacity 0.15s",
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: colorMap[s.user_id], flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 12,
                  fontWeight: s.isCurrentUser ? 800 : 500,
                  color: s.isCurrentUser ? "var(--bolao-lime)" : "var(--bolao-ink-dim)",
                  fontFamily: '"Noto Sans", system-ui, sans-serif',
                  maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {capitalizeName(s.display_name)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
