"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Game, Odds, Prediction, GameScore } from "@/lib/supabase/types";
import { translateTeamName, TEAM_FLAGS } from "@/lib/translations/teams";
import GameModal from "./GameModal";

/* ---- constants ---- */

const PHASES: { stage: string; label: string }[] = [
  { stage: "Round of 32",   label: "Rodada de 32" },
  { stage: "Round of 16",   label: "Oitavas de final" },
  { stage: "Quarter-finals", label: "Quartas de final" },
  { stage: "Semi-finals",   label: "Semifinais" },
  { stage: "Final",         label: "Final" },
];

const STAGE_ALIASES: Record<string, string> = {
  r32: "Round of 32", last_32: "Round of 32", LAST_32: "Round of 32",
  r16: "Round of 16", last_16: "Round of 16", LAST_16: "Round of 16",
  qf: "Quarter-finals", sf: "Semi-finals",
  third: "3rd Place", Final: "Final",
};

function normalizeStage(stage: string | null): string | null {
  if (!stage) return null;
  return STAGE_ALIASES[stage] ?? stage;
}

// Layout constants (Confortável)
const CW = 238;
const CH = 100;
const RG = 16;
const CG = 66;
const PAD = 12;
const HEADER_H = 46;
const EASE = "cubic-bezier(.45,.02,.18,1)";
const THIRD_PLACE_GAP = 100;

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "FINISHED"]);

/* ---- helpers ---- */

function FlagChip({ teamName, logoUrl, size = 27 }: { teamName: string; logoUrl: string | null; size?: number }) {
  const slug = TEAM_FLAGS[teamName] ?? null;
  const h = Math.round(size * 0.68);
  const src = slug ? `/flags/regular/${slug}.png` : logoUrl;
  return (
    <span style={{
      width: size, height: h, flexShrink: 0, display: "inline-block", overflow: "hidden",
      borderRadius: "5px 2px 5px 2px",
      border: "1.4px solid rgba(247,247,248,0.92)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
      background: src ? "transparent" : "rgba(247,247,248,0.13)",
    }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={teamName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
      ) : null}
    </span>
  );
}

/* ---- bracket card ---- */

interface BracketCardProps {
  game: Game;
  prediction: Prediction | null;
  score: GameScore | null;
  style: React.CSSProperties;
  onClick: () => void;
}

const LIVE_STATUSES = new Set(["LIVE", "1H", "HT", "2H", "ET", "BT", "P", "PAUSED"]);

function BracketCard({ game, prediction, score, style, onClick }: BracketCardProps) {
  const isFinished = FINISHED_STATUSES.has(game.status);
  const isLive = LIVE_STATUSES.has(game.status);
  const isLocked = !isLive && !isFinished &&
    new Date(game.match_date).getTime() - Date.now() <= 5 * 60_000;
  const isTBD = game.home_team === "TBD" || game.away_team === "TBD";
  const isPen = game.status === "PEN";

  const homeTeam = translateTeamName(game.home_team);
  const awayTeam = translateTeamName(game.away_team);

  const knockoutWinner = game.knockout_winner as "home" | "away" | null;

  const breakdown = score
    ? (score.breakdown as { correctAdvance?: boolean } | null)
    : null;

  const date = new Date(game.match_date);
  const dateFmt = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const timeFmt = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function TeamRow({ side }: { side: "home" | "away" }) {
    const name = side === "home" ? homeTeam : awayTeam;
    const logo = side === "home" ? game.home_team_logo : game.away_team_logo;
    const actualScore = side === "home" ? game.home_score : game.away_score;
    const predScore = side === "home" ? prediction?.home_score : prediction?.away_score;
    const isWinner = isFinished && knockoutWinner === side;
    const isLoser = isFinished && knockoutWinner !== null && knockoutWinner !== side;
    const advPick = prediction?.advance_pick as "home" | "away" | null | undefined;
    const pickedThis = advPick === side;
    const advCorrect = isFinished && pickedThis && breakdown?.correctAdvance;
    const advWrong = isFinished && pickedThis && breakdown?.correctAdvance === false;

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 28, position: "relative" }}>
        {/* Flag */}
        <span style={{ position: "relative", flexShrink: 0 }}>
          {isTBD ? (
            <span style={{ width: 27, height: 18, display: "inline-block", borderRadius: "5px 2px 5px 2px", background: "rgba(247,247,248,0.13)", border: "1.4px solid rgba(247,247,248,0.08)" }} />
          ) : (
            <FlagChip teamName={name} logoUrl={logo} size={27} />
          )}
          {/* Advance badge */}
          {isFinished && pickedThis && (advCorrect || advWrong) && (
            <span style={{
              position: "absolute", bottom: 2, right: -6,
              width: 14, height: 14, borderRadius: 99,
              background: advCorrect ? "var(--bolao-green-win)" : "var(--bolao-red)",
              border: "2px solid var(--bolao-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 800, color: "#fff",
              lineHeight: 1, fontFamily: "system-ui, sans-serif",
            }}>{advCorrect ? "✓" : "✕"}</span>
          )}
        </span>

        {/* Name */}
        <span style={{
          flex: 1, fontFamily: '"FWC2026", system-ui, sans-serif',
          fontSize: 12, fontWeight: isWinner ? 800 : 600,
          textTransform: "uppercase", letterSpacing: "0.01em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: isTBD ? "var(--bolao-ink-faint)" : isWinner ? "var(--bolao-lime)" : isLoser ? "var(--bolao-ink-faint)" : "var(--bolao-ink)",
        }}>{isTBD ? "A definir" : name}</span>

        {/* Score column */}
        <span style={{
          width: 20, textAlign: "center",
          fontFamily: '"FWC2026", system-ui, sans-serif',
          fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums",
          color: isLoser ? "var(--bolao-ink-faint)" : "var(--bolao-ink)",
        }}>
          {isFinished ? (actualScore ?? "–") : (predScore != null ? predScore : "–")}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        width: CW, height: CH,
        background: "var(--bolao-surface)",
        border: `1px solid ${isFinished ? "var(--bolao-hairline-2)" : "var(--bolao-hairline)"}`,
        borderRadius: 14,
        boxShadow: "0 10px 24px -18px rgba(0,0,0,0.9)",
        cursor: "pointer",
        overflow: "visible",
        transition: `left .52s ${EASE}, top .52s ${EASE}, opacity .34s ease`,
        ...style,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--bolao-ink-faint)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = isFinished ? "var(--bolao-hairline-2)" : "var(--bolao-hairline)")}
    >
      {/* Card header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 10px 5px",
        borderBottom: "1px solid var(--bolao-hairline)",
      }}>
        <span style={{
          fontFamily: '"FWC2026", system-ui, sans-serif',
          fontSize: 10, fontWeight: 800, color: "var(--bolao-ink-dim)",
          fontVariantNumeric: "tabular-nums", letterSpacing: "0.01em",
        }}>
          {dateFmt} · {timeFmt}
        </span>
        {isLive && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "var(--bolao-red)", letterSpacing: "0.03em" }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--bolao-red)", display: "inline-block", animation: "livePulse 1.1s ease-in-out infinite", flexShrink: 0 }} />
            Ao vivo
          </span>
        )}
        {isLocked && !isLive && (
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "var(--bolao-ink-faint)", letterSpacing: "0.03em" }}>🔒 Travado</span>
        )}
        {isFinished && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {isPen && (
              <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", color: "var(--bolao-ink-faint)", letterSpacing: "0.03em" }}>pên</span>
            )}
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "var(--bolao-ink-faint)", letterSpacing: "0.03em" }}>Encerrado</span>
          </span>
        )}
      </div>

      {/* Teams — right padding always reserves space for the score indicator */}
      <div style={{ position: "relative", padding: "6px 20px 6px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        <TeamRow side="home" />
        <TeamRow side="away" />
        {isFinished && prediction && (() => {
          const isExact = !!(score?.breakdown as { exact?: boolean } | null)?.exact;
          return (
            <span style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              width: 18, height: 18, borderRadius: 99,
              background: isExact ? "var(--bolao-green-win)" : "var(--bolao-red)",
              border: "2px solid var(--bolao-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: "#fff",
              lineHeight: 1, fontFamily: "system-ui, sans-serif",
            }}>{isExact ? "✓" : "✕"}</span>
          );
        })()}
      </div>
    </div>
  );
}

/* ---- connector lines ---- */

function Connector({ x1, y1, x2, y2, visible }: { x1: number; y1: number; x2: number; y2: number; visible: boolean }) {
  const midX = (x1 + x2) / 2;
  return (
    <>
      {/* Horizontal from child */}
      <div style={{ position: "absolute", left: x1, top: y1 - 1, width: midX - x1, height: 2, background: "var(--bolao-hairline-2)", borderRadius: 1, opacity: visible ? 1 : 0, transition: `left .52s ${EASE}, top .52s ${EASE}, width .52s ${EASE}, opacity .3s ease` }} />
      {/* Vertical joining */}
      <div style={{ position: "absolute", left: midX - 1, top: Math.min(y1, y2) - 1, width: 2, height: Math.abs(y2 - y1) + 2, background: "var(--bolao-hairline-2)", borderRadius: 1, opacity: visible ? 1 : 0, transition: `left .52s ${EASE}, top .52s ${EASE}, height .52s ${EASE}, opacity .3s ease` }} />
    </>
  );
}

/* ---- bracket computation ---- */

interface BracketSlot {
  game: Game;
  phase: number;
  slot: number;
  topY: number;
}

function buildBracket(games: Game[], focus: number): BracketSlot[] {
  const pitch = CH + RG;

  const byPhase: Game[][] = PHASES.map(({ stage }) =>
    games
      .filter((g) => normalizeStage(g.stage) === stage)
      .sort((a, b) => {
        const sa = a.bracket_slot;
        const sb = b.bracket_slot;
        if (sa != null && sb != null) return sa - sb;
        if (sa != null) return -1;
        if (sb != null) return 1;
        return new Date(a.match_date).getTime() - new Date(b.match_date).getTime();
      })
  );

  const topYMap: number[][] = PHASES.map(() => []);

  // 1. Focused phase: evenly spaced (this is the "compact base")
  byPhase[focus].forEach((_, i) => {
    topYMap[focus][i] = PAD + i * pitch;
  });

  // 2. Expand rightward: each parent Y = avg of its two children
  for (let p = focus + 1; p < PHASES.length; p++) {
    byPhase[p].forEach((_, i) => {
      const y1 = topYMap[p - 1][i * 2] ?? PAD;
      const y2 = topYMap[p - 1][i * 2 + 1] ?? y1;
      topYMap[p][i] = (y1 + y2) / 2;
    });
  }

  // 3. Collapse leftward: each card nests into its parent's Y in the next phase
  for (let p = focus - 1; p >= 0; p--) {
    byPhase[p].forEach((_, i) => {
      topYMap[p][i] = topYMap[p + 1][Math.floor(i / 2)] ?? PAD;
    });
  }

  const slots: BracketSlot[] = [];
  PHASES.forEach((_, p) => {
    byPhase[p].forEach((g, i) => {
      slots.push({ game: g, phase: p, slot: i, topY: topYMap[p][i] });
    });
  });
  return slots;
}


/* ---- main component ---- */

interface Props {
  games: Game[];
  odds: Odds[];
  predictions: Prediction[];
  scores: GameScore[];
  onSave: (gameId: string, home: number, away: number, advancePick?: "home" | "away" | null) => Promise<void>;
}

export default function BracketView({ games, odds, predictions, scores, onSave }: Props) {
  const [focus, setFocus] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const scrollCooldown = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchIntent = useRef<"horizontal" | "vertical" | null>(null);

  const knockoutGames = useMemo(() =>
    games.filter((g) => {
      const norm = normalizeStage(g.stage);
      return PHASES.some((p) => p.stage === norm);
    }),
    [games]
  );

  const thirdPlaceGame = useMemo(() =>
    games.find((g) => normalizeStage(g.stage) === "3rd Place") ?? null,
    [games]
  );

  const slots = useMemo(() => buildBracket(knockoutGames, focus), [knockoutGames, focus]);

  const finalSlot = useMemo(() =>
    slots.find((s) => s.phase === PHASES.length - 1) ?? null,
    [slots]
  );

  // Height based on actual max card position in the current layout, not always R32 count
  const fieldHeight = useMemo(() => {
    if (slots.length === 0) return PAD * 2 + CH;
    let maxBottom = PAD + CH;
    for (const s of slots) {
      maxBottom = Math.max(maxBottom, s.topY + CH);
    }
    if (thirdPlaceGame && finalSlot) {
      maxBottom = Math.max(maxBottom, finalSlot.topY + CH + THIRD_PLACE_GAP + CH);
    }
    return maxBottom + PAD;
  }, [slots, thirdPlaceGame, finalSlot]);

  const focusedSlots = useMemo(() => slots.filter((s) => s.phase === focus), [slots, focus]);

  const focusedMinY = useMemo(() =>
    focusedSlots.length > 0 ? Math.min(...focusedSlots.map((s) => s.topY)) : PAD,
    [focusedSlots]
  );

  const focusedMaxY = useMemo(() => {
    if (focusedSlots.length === 0) return PAD;
    let maxY = Math.max(...focusedSlots.map((s) => s.topY));
    if (thirdPlaceGame && finalSlot) {
      maxY = Math.max(maxY, finalSlot.topY + CH + THIRD_PLACE_GAP);
    }
    return maxY;
  }, [focusedSlots, finalSlot, thirdPlaceGame]);

  // Container grows/shrinks to the focused phase's content — no internal vertical scroll.
  // Formula: header + translate-corrected card bottom + bottom padding.
  const containerHeight = HEADER_H + 2 * PAD + (focusedMaxY - focusedMinY) + CH;
  const verticalOffset = focusedMinY - PAD;

  const fieldWidth = PHASES.length * (CW + CG) - CG + PAD * 2;

  const selGame = selId ? games.find((g) => g.id === selId) ?? null : null;
  const selOdds = selId ? odds.find((o) => o.game_id === selId) ?? null : null;
  const selPred = selId ? predictions.find((p) => p.game_id === selId) ?? null : null;
  const selScore = selId ? scores.find((s) => s.game_id === selId) ?? null : null;

  // Reset scroll position to top whenever the focused phase changes
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [focus]);

  // Horizontal scroll navigates phases with the same glide animation as the arrows
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Vertical scroll: let the page/container scroll normally
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      // Consume all horizontal swipes to prevent browser back/forward navigation
      e.preventDefault();
      if (scrollCooldown.current) return;
      const dir = e.deltaX > 10 ? 1 : e.deltaX < -10 ? -1 : 0;
      if (dir === 0) return;
      setFocus((f) => Math.max(0, Math.min(PHASES.length - 1, f + dir)));
      scrollCooldown.current = true;
      // cooldown slightly longer than the animation duration
      setTimeout(() => { scrollCooldown.current = false; }, 600);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Mobile swipe navigates phases with the same glide animation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchIntent.current = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (touchIntent.current === null) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
          touchIntent.current = "horizontal";
        } else if (Math.abs(dy) > 5) {
          touchIntent.current = "vertical";
        }
      }
      // Prevent vertical scroll while the user is doing a horizontal swipe
      if (touchIntent.current === "horizontal") e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchIntent.current !== "horizontal") return;
      if (scrollCooldown.current) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) < 50) return; // too small to be intentional
      const dir = dx < 0 ? 1 : -1;
      setFocus((f) => Math.max(0, Math.min(PHASES.length - 1, f + dir)));
      scrollCooldown.current = true;
      setTimeout(() => { scrollCooldown.current = false; }, 600);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div>
      {/* Bracket container
          overflow-y:auto makes this a scroll container so position:sticky on the header
          works correctly when the phase content is taller than the viewport.
          overflow-x:hidden clips card animations that slide in/out horizontally.
          maxHeight caps height for tall phases (R32/R16); smaller phases shrink naturally. */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          overflowX: "hidden",
          overflowY: "auto",
          maxHeight: "80vh",
          height: containerHeight,
          transition: `height .52s ${EASE}`,
          border: "1px solid var(--bolao-hairline)", borderRadius: 16,
          background: "rgba(10,10,14,0.35)",
        }}
      >
        {/* Sticky header — stays visible while scrolling through long phases */}
        <div style={{
          position: "sticky", top: 0, height: HEADER_H, zIndex: 10,
          background: "linear-gradient(180deg, rgba(16,16,22,0.97), rgba(16,16,22,0.85))",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--bolao-hairline)",
        }}>
          {PHASES.map(({ label }, r) => {
            const active = r === focus;
            const left = PAD + (r - focus) * (CW + CG);
            return (
              <button
                key={r}
                onClick={() => setFocus(r)}
                style={{
                  position: "absolute",
                  left, top: 0, width: CW, height: HEADER_H,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: '"FWC2026", system-ui, sans-serif',
                  fontSize: 13, fontWeight: 800, textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  color: active ? "var(--bolao-lime)" : "var(--bolao-ink)",
                  transition: `left .52s ${EASE}, color .3s ease, opacity .3s ease`,
                  opacity: active ? 1 : 0.6,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}

          {/* Nav arrows — inside sticky header so they remain accessible while scrolling */}
          {[
            { dir: -1, side: "left" as const, disabled: focus === 0 },
            { dir: 1, side: "right" as const, disabled: focus === PHASES.length - 1 },
          ].map(({ dir, side, disabled }) => (
            <button
              key={side}
              onClick={() => setFocus((f) => Math.max(0, Math.min(PHASES.length - 1, f + dir)))}
              style={{
                position: "absolute",
                top: Math.floor((HEADER_H - 38) / 2),
                [side]: 8,
                width: 38, height: 38, borderRadius: 99,
                border: "1px solid var(--bolao-hairline-2)",
                background: "rgba(21,21,25,0.92)", backdropFilter: "blur(6px)",
                cursor: disabled ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 16, color: "var(--bolao-ink)",
                opacity: disabled ? 0.22 : 0.9, pointerEvents: disabled ? "none" : "auto",
                transition: "opacity .2s",
                zIndex: 5,
              }}
            >
              {dir === -1 ? "‹" : "›"}
            </button>
          ))}
        </div>

        {/* Field */}
        <div style={{ position: "relative", width: fieldWidth, height: fieldHeight, transform: `translateY(${-verticalOffset}px)`, transition: `transform .52s ${EASE}` }}>
          {/* Connector lines (phase r ≥ focus+1) */}
          {slots.map((slot) => {
            if (slot.phase === 0) return null;
            const prevSlots = slots.filter((s) => s.phase === slot.phase - 1);
            const child1 = prevSlots[slot.slot * 2];
            const child2 = prevSlots[slot.slot * 2 + 1];
            if (!child1 || !child2) return null;

            const r = slot.phase;
            const x2 = PAD + (r - focus) * (CW + CG);
            const y2 = slot.topY + CH / 2;
            const x1end = PAD + (r - 1 - focus) * (CW + CG) + CW;
            const y1 = child1.topY + CH / 2;
            const y2child = child2.topY + CH / 2;
            const visible = r >= focus + 1;
            const midX = (x1end + x2) / 2;

            return (
              <div key={`conn-${slot.phase}-${slot.slot}`}>
                {/* child1 → mid */}
                <div style={{ position: "absolute", left: x1end, top: y1 - 1, width: midX - x1end, height: 2, background: "var(--bolao-hairline-2)", borderRadius: 1, opacity: visible ? 0.8 : 0, transition: `left .52s ${EASE}, top .52s ${EASE}, width .52s ${EASE}, opacity .3s ease` }} />
                {/* child2 → mid */}
                <div style={{ position: "absolute", left: x1end, top: y2child - 1, width: midX - x1end, height: 2, background: "var(--bolao-hairline-2)", borderRadius: 1, opacity: visible ? 0.8 : 0, transition: `left .52s ${EASE}, top .52s ${EASE}, width .52s ${EASE}, opacity .3s ease` }} />
                {/* vertical join */}
                <Connector x1={midX} y1={y1} x2={midX} y2={y2child} visible={visible} />
                {/* mid → parent */}
                <div style={{ position: "absolute", left: midX, top: y2 - 1, width: x2 - midX, height: 2, background: "var(--bolao-hairline-2)", borderRadius: 1, opacity: visible ? 0.8 : 0, transition: `left .52s ${EASE}, top .52s ${EASE}, width .52s ${EASE}, opacity .3s ease` }} />
              </div>
            );
          })}

          {/* Cards */}
          {slots.map((slot) => {
            const left = PAD + (slot.phase - focus) * (CW + CG);
            const pred = predictions.find((p) => p.game_id === slot.game.id) ?? null;
            const sc = scores.find((s) => s.game_id === slot.game.id) ?? null;
            return (
              <BracketCard
                key={slot.game.id}
                game={slot.game}
                prediction={pred}
                score={sc}
                style={{ left, top: slot.topY }}
                onClick={() => setSelId(slot.game.id)}
              />
            );
          })}

          {/* 3rd Place — same column as Final, extra gap below */}
          {thirdPlaceGame && finalSlot && (() => {
            const left = PAD + (PHASES.length - 1 - focus) * (CW + CG);
            const cardTop = finalSlot.topY + CH + THIRD_PLACE_GAP;
            const labelTop = cardTop - 22;
            return (
              <>
                <div style={{
                  position: "absolute", left, top: labelTop, width: CW,
                  display: "flex", alignItems: "center", gap: 8,
                  transition: `left .52s ${EASE}`,
                }}>
                  <span style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--bolao-ink-dim)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>3° lugar</span>
                  <span style={{ flex: 1, height: 1, background: "var(--bolao-hairline)" }} />
                </div>
                <BracketCard
                  game={thirdPlaceGame}
                  prediction={predictions.find((p) => p.game_id === thirdPlaceGame.id) ?? null}
                  score={scores.find((s) => s.game_id === thirdPlaceGame.id) ?? null}
                  style={{ left, top: cardTop }}
                  onClick={() => setSelId(thirdPlaceGame.id)}
                />
              </>
            );
          })()}
        </div>
      </div>

      {/* Modal */}
      {selGame && (
        <GameModal
          game={selGame}
          odds={selOdds}
          prediction={selPred}
          score={selScore}
          onSave={onSave}
          onClose={() => setSelId(null)}
        />
      )}
    </div>
  );
}
