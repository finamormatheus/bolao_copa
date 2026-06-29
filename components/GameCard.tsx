"use client";

import { useState, useEffect, useTransition } from "react";
import type { Game, Odds, Prediction, GameScore } from "@/lib/supabase/types";
import { probabilityToPoints } from "@/lib/scoring/calculator";
import { translateTeamName, TEAM_FLAGS } from "@/lib/translations/teams";
import { GroupReveal } from "./GroupReveal";

/* ---- helpers ---- */

const GROUP_COLORS: Record<string, string> = {
  A: "rgb(1,230,118)", B: "rgb(255,22,68)", C: "rgb(255,145,3)",
  D: "rgb(48,79,254)", E: "rgb(98,0,234)", F: "rgb(199,255,2)",
  G: "rgb(240,98,146)", H: "rgb(100,255,218)", I: "rgb(171,71,188)",
  J: "rgb(0,120,136)", K: "rgb(255,61,0)", L: "rgb(33,150,243)",
};

const STAGE_PT: Record<string, string> = {
  "Group Stage":    "Fase de Grupos",
  "Round of 32":    "Rodada de 32",
  "r32":            "Rodada de 32",
  "last_32":        "Rodada de 32",
  "LAST_32":        "Rodada de 32",
  "Round of 16":    "Oitavas de final",
  "r16":            "Oitavas de final",
  "last_16":        "Oitavas de final",
  "LAST_16":        "Oitavas de final",
  "Quarter-finals": "Quartas de final",
  "qf":             "Quartas de final",
  "Semi-finals":    "Semi final",
  "sf":             "Semi final",
  "3rd Place":      "Terceiro lugar",
  "third":          "Terceiro lugar",
  "Final":          "Final",
};

function translateStage(stage: string | null): string | null {
  if (!stage) return null;
  return STAGE_PT[stage] ?? stage;
}

function groupLetter(groupName: string | null): string | null {
  if (!groupName) return null;
  const m = groupName.match(/\b([A-L])\b/i);
  return m ? m[1].toUpperCase() : null;
}

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short",
  });
}

function outcome(h: number, a: number): "home" | "draw" | "away" {
  return h > a ? "home" : a > h ? "away" : "draw";
}

const LOCK_MINUTES = 5;
function isWithinLock(dateStr: string): boolean {
  return new Date(dateStr).getTime() - Date.now() <= LOCK_MINUTES * 60_000;
}

const KNOCKOUT_STAGES = new Set([
  "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final", "3rd Place",
  "r32", "r16", "qf", "sf", "third", "last_32", "last_16", "LAST_32", "LAST_16",
]);

/* ---- sub-components ---- */

export function AdvancePicker({
  homeTeam, awayTeam, homeLogoUrl, awayLogoUrl,
  value, onChange, disabled,
}: {
  homeTeam: string; awayTeam: string;
  homeLogoUrl: string | null; awayLogoUrl: string | null;
  value: "home" | "away" | null;
  onChange: (v: "home" | "away") => void;
  disabled?: boolean;
}) {
  const teams: { key: "home" | "away"; name: string; logoUrl: string | null }[] = [
    { key: "home", name: homeTeam, logoUrl: homeLogoUrl },
    { key: "away", name: awayTeam, logoUrl: awayLogoUrl },
  ];
  return (
    <div>
      <div style={{
        fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
        color: "var(--bolao-ink-faint)", letterSpacing: "0.05em",
        fontFamily: '"Noto Sans", system-ui, sans-serif', marginBottom: 6,
      }}>
        Quem avança?
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {teams.map((t) => {
          const selected = value === t.key;
          return (
            <button
              key={t.key}
              disabled={disabled}
              onClick={() => onChange(t.key)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "8px 10px", borderRadius: 10,
                background: selected ? "rgba(173,235,3,0.08)" : "rgba(247,247,248,0.04)",
                border: selected ? "1px solid var(--bolao-lime)" : "1px solid var(--bolao-hairline)",
                cursor: disabled ? "default" : "pointer",
                transition: "border-color .15s, background .15s",
              }}
            >
              <FlagChip teamName={t.name} logoUrl={t.logoUrl} size={27} />
              <span style={{
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontSize: 12, fontWeight: 800, textTransform: "uppercase",
                color: selected ? "var(--bolao-lime)" : "var(--bolao-ink-dim)",
                letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FlagChip({ teamName, logoUrl, size = 46 }: { teamName: string; logoUrl: string | null; size?: number }) {
  const slug = TEAM_FLAGS[teamName] ?? null;
  const h = Math.round(size * 0.68);
  const big = Math.max(6, Math.round(size * 0.3));
  const sm = Math.max(2, Math.round(size * 0.085));
  const src = slug ? `/flags/regular/${slug}.png` : logoUrl;
  return (
    <span style={{
      width: size, height: h,
      borderRadius: `${big}px ${sm}px ${big}px ${sm}px`,
      overflow: "hidden",
      flexShrink: 0,
      display: "inline-block",
      border: "1.5px solid rgba(247,247,248,0.92)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
      background: "var(--bolao-surface-3)",
    }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={teamName}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
      ) : (
        <span style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: "var(--bolao-ink-dim)",
        }}>
          {teamName.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function GroupBadge({ group }: { group: string }) {
  const color = GROUP_COLORS[group] ?? "rgba(247,247,248,0.2)";
  return (
    <span style={{
      background: color, color: "var(--bolao-ink-dark)",
      fontFamily: '"FWC2026", system-ui, sans-serif',
      fontWeight: 800, fontSize: 13, lineHeight: 1,
      padding: "6px 12px 5px", borderRadius: 999,
      whiteSpace: "nowrap", letterSpacing: "0.02em",
      textTransform: "uppercase",
    }}>
      Grupo {group}
    </span>
  );
}

function StatusChip({ kind }: { kind: "live" | "final" | "locked" }) {
  const map = {
    live:   { label: "Ao vivo",   fg: "#fff",                  bg: "var(--bolao-red)" },
    final:  { label: "Encerrado", fg: "var(--bolao-ink-dim)",  bg: "rgba(247,247,248,0.10)" },
    locked: { label: "Travado",   fg: "var(--bolao-ink-dim)",  bg: "rgba(247,247,248,0.10)" },
  };
  const s = map[kind];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: '"FWC2026", system-ui, sans-serif',
      fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
      color: s.fg, background: s.bg, padding: "5px 9px 4px", borderRadius: 999,
    }}>
      {kind === "live" && (
        <span style={{
          width: 7, height: 7, borderRadius: 99, background: "#fff",
          animation: "livePulse 1.1s ease-in-out infinite", flexShrink: 0,
          display: "inline-block",
        }} />
      )}
      {kind === "locked" && <span style={{ fontSize: 11 }}>🔒</span>}
      {s.label}
    </span>
  );
}

function ScorePillInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="numeric"
      maxLength={2}
      value={value}
      placeholder="–"
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
      style={{
        width: 54, height: 50, borderRadius: 12, border: "none",
        background: "var(--bolao-pill)", color: "var(--bolao-ink-dark)",
        textAlign: "center", fontSize: 28, fontWeight: 800,
        fontFamily: '"FWC2026", system-ui, sans-serif',
        padding: 0, outline: "none",
        boxShadow: "0 0 0 2px transparent",
        transition: "box-shadow .15s ease",
        fontVariantNumeric: "tabular-nums",
      }}
      onFocus={(e) => (e.target.style.boxShadow = "0 0 0 3px var(--bolao-lime)")}
      onBlur={(e) => (e.target.style.boxShadow = "0 0 0 2px transparent")}
    />
  );
}

function ScorePillStatic({ value, live, dim }: { value: number | null; live?: boolean; dim?: boolean }) {
  return (
    <span style={{
      width: 54, height: 50, borderRadius: 12,
      background: dim ? "rgba(247,247,248,0.55)" : "var(--bolao-pill)",
      color: "var(--bolao-ink-dark)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 28, fontWeight: 800,
      fontFamily: '"FWC2026", system-ui, sans-serif',
      boxShadow: live ? "0 0 0 2px var(--bolao-red)" : "none",
      fontVariantNumeric: "tabular-nums",
    }}>
      {value ?? "–"}
    </span>
  );
}

function TeamSide({ name, logoUrl, align }: { name: string; logoUrl: string | null; align: "left" | "right" }) {
  const right = align === "right";
  return (
    <div className={`team-side ${right ? "right" : "left"}`}>
      <FlagChip teamName={name} logoUrl={logoUrl} />
      <span className="team-name" style={{
        fontFamily: '"FWC2026", system-ui, sans-serif',
        letterSpacing: "0.01em",
        textTransform: "uppercase", color: "var(--bolao-ink)",
      }}>
        {name}
      </span>
    </div>
  );
}

function OddsStrip({
  homeTeam, awayTeam, homeProb, drawProb, awayProb,
}: {
  homeTeam: string; awayTeam: string;
  homeProb: number; drawProb: number; awayProb: number;
}) {
  const cells = [
    { label: homeTeam, prob: homeProb },
    { label: "Empate",  prob: drawProb },
    { label: awayTeam,  prob: awayProb },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {cells.map((c, i) => (
        <div key={i} style={{
          flex: 1, textAlign: "center", padding: "7px 6px",
          background: "rgba(247,247,248,0.04)", borderRadius: 10,
          border: "1px solid var(--bolao-hairline)",
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
            color: "var(--bolao-ink-faint)", letterSpacing: "0.05em", lineHeight: 1.25,
            fontFamily: '"Noto Sans", system-ui, sans-serif',
          }}>
            {c.label}
          </div>
          <div style={{
            fontFamily: '"FWC2026", system-ui, sans-serif',
            fontSize: 15, fontWeight: 800, marginTop: 1, color: "var(--bolao-ink)",
          }}>
            {Math.round(c.prob * 100)}%
          </div>
          <div style={{
            fontFamily: '"FWC2026", system-ui, sans-serif',
            fontSize: 10.5, color: "var(--bolao-lime)", fontWeight: 700,
          }}>
            +{probabilityToPoints(c.prob)} pts
          </div>
        </div>
      ))}
    </div>
  );
}

function LockedOddsStrip({
  homeTeam, awayTeam, homeProb, drawProb, awayProb, winner,
}: {
  homeTeam: string; awayTeam: string;
  homeProb: number; drawProb: number; awayProb: number;
  winner: "home" | "draw" | "away" | null;
}) {
  const cells: { label: string; prob: number; key: "home" | "draw" | "away" }[] = [
    { label: homeTeam, prob: homeProb, key: "home" },
    { label: "Empate",  prob: drawProb, key: "draw" },
    { label: awayTeam,  prob: awayProb, key: "away" },
  ];
  return (
    <div>
      <div style={{
        fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
        color: "var(--bolao-ink-faint)", letterSpacing: "0.05em", lineHeight: 1,
        fontFamily: '"Noto Sans", system-ui, sans-serif',
        marginBottom: 6,
      }}>
        🔒 Odds no fechamento
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {cells.map((c) => {
          const isWinner = winner === c.key;
          const isLoser = winner !== null && !isWinner;
          return (
            <div key={c.key} style={{
              flex: 1, textAlign: "center", padding: "7px 6px",
              background: isWinner ? "rgba(1,230,118,0.08)" : "rgba(247,247,248,0.04)",
              borderRadius: 10,
              border: isWinner
                ? "1px solid rgba(1,230,118,0.45)"
                : "1px solid var(--bolao-hairline)",
              opacity: isLoser ? 0.4 : 1,
              transition: "opacity .15s",
            }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
                color: isWinner ? "var(--bolao-lime)" : "var(--bolao-ink-faint)",
                letterSpacing: "0.05em", lineHeight: 1.25,
                fontFamily: '"Noto Sans", system-ui, sans-serif',
              }}>
                {c.label}
              </div>
              <div style={{
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontSize: 15, fontWeight: 800, marginTop: 1,
                color: isWinner ? "var(--bolao-lime)" : "var(--bolao-ink-dim)",
              }}>
                {Math.round(c.prob * 100)}%
              </div>
              <div style={{
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontSize: 10.5, fontWeight: 700,
                color: isWinner ? "var(--bolao-lime)" : "var(--bolao-ink-faint)",
              }}>
                +{probabilityToPoints(c.prob)} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ---- main component ---- */

interface GameCardProps {
  game: Game;
  odds: Odds | null;
  prediction: Prediction | null;
  score: GameScore | null;
  onSave: (gameId: string, home: number, away: number, advancePick?: "home" | "away" | null) => Promise<void>;
  groupStripe?: boolean;
  showDate?: boolean;
}

export default function GameCard({ game, odds, prediction, score, onSave, groupStripe = true, showDate = false }: GameCardProps) {
  const [homeInput, setHomeInput] = useState(prediction?.home_score?.toString() ?? "");
  const [awayInput, setAwayInput] = useState(prediction?.away_score?.toString() ?? "");
  const [advancePick, setAdvancePick] = useState<"home" | "away" | null>(
    (prediction?.advance_pick as "home" | "away" | null) ?? null
  );
  const [, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "invalid" | "tieNoPick" | "error">("idle");
  const [withinLock, setWithinLock] = useState(false);

  const isKnockout = !!(game.stage && KNOCKOUT_STAGES.has(game.stage));

  const homeNum = parseInt(homeInput);
  const awayNum = parseInt(awayInput);
  const scoreKnown = homeInput !== "" && awayInput !== "" && !isNaN(homeNum) && !isNaN(awayNum);
  const scoredWinner: "home" | "away" | null = scoreKnown && homeNum !== awayNum
    ? (homeNum > awayNum ? "home" : "away")
    : null;
  const effectiveAdvancePick = scoredWinner ?? advancePick;

  const isSaved =
    prediction !== null &&
    prediction.home_score === parseInt(homeInput) &&
    prediction.away_score === parseInt(awayInput) &&
    (!isKnockout || (prediction.advance_pick ?? null) === effectiveAdvancePick);

  useEffect(() => {
    const check = () => setWithinLock(isWithinLock(game.match_date));
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [game.match_date]);

  const isFinished = ["FT", "AET", "PEN", "FINISHED"].includes(game.status);
  const isLive = ["LIVE", "1H", "HT", "2H", "ET", "BT", "P", "PAUSED"].includes(game.status);
  const locked = isFinished || isLive || withinLock;
  const canEdit = !locked;
  const showActual = isLive || isFinished;

  function handleSave() {
    if (homeInput === "" || awayInput === "") {
      setSaveState("invalid");
      setTimeout(() => setSaveState("idle"), 1800);
      return;
    }
    const home = parseInt(homeInput);
    const away = parseInt(awayInput);
    if (isNaN(home) || isNaN(away)) {
      setSaveState("invalid");
      setTimeout(() => setSaveState("idle"), 1800);
      return;
    }
    if (isKnockout && effectiveAdvancePick === null) {
      const isTie = home === away;
      setSaveState(isTie ? "tieNoPick" : "invalid");
      setTimeout(() => setSaveState("idle"), 2200);
      return;
    }
    startTransition(async () => {
      try {
        await onSave(game.id, home, away, isKnockout ? effectiveAdvancePick : null);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1800);
      } catch {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    });
  }

  const resultPts = isFinished && score ? score.total_points : null;
  const breakdown = isFinished && score
    ? (score.breakdown as { exact?: boolean; correctAdvance?: boolean } | null)
    : null;
  const isExact = !!(breakdown?.exact);
  const isCorrectAdvance = !!(breakdown?.correctAdvance);

  const group = groupLetter(game.group_name);
  const groupColor = group ? (GROUP_COLORS[group] ?? null) : null;
  const hasOdds = !!(odds?.home_win_prob && odds?.draw_prob && odds?.away_win_prob);
  const hasLockedOdds = !!(game.locked_home_win_prob && game.locked_draw_prob && game.locked_away_win_prob);
  const winner: "home" | "draw" | "away" | null =
    isFinished && game.home_score !== null && game.away_score !== null
      ? outcome(game.home_score, game.away_score)
      : null;

  return (
    <div style={{
      borderRadius: "var(--bolao-radius-card)",
      overflow: "hidden",
      boxShadow: "0 1px 0 rgba(247,247,248,0.04), 0 12px 30px -18px rgba(0,0,0,0.8)",
      borderLeft: groupStripe && groupColor ? `3px solid ${groupColor}` : "none",
    }}>
      {/* DETAIL ROW */}
      <div style={{
        background: "var(--bolao-surface-2)", padding: "11px 14px 11px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          {showDate && (
            <span style={{
              fontFamily: '"Noto Sans", system-ui, sans-serif',
              fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              color: "var(--bolao-ink-dim)",
            }}>
              {fmtDate(game.match_date)}
            </span>
          )}
          <span style={{
            fontFamily: '"FWC2026", system-ui, sans-serif',
            fontSize: 13, fontWeight: 800, letterSpacing: "0.02em",
            textTransform: "uppercase", whiteSpace: "nowrap",
            color: "var(--bolao-ink)", fontVariantNumeric: "tabular-nums",
          }}>
            {fmtTime(game.match_date)}
          </span>
          {game.stage && (
            <>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "rgba(247,247,248,0.4)", flexShrink: 0 }} />
              <span style={{
                fontSize: 12.5, color: "var(--bolao-ink-dim)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontFamily: '"Noto Sans", system-ui, sans-serif',
              }}>{translateStage(game.stage)}</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {isLive && <StatusChip kind="live" />}
          {isFinished && <StatusChip kind="final" />}
          {!showActual && withinLock && <StatusChip kind="locked" />}
          {group && <GroupBadge group={group} />}

        </div>
      </div>

      {/* MATCH ROW */}
      <div style={{ background: "var(--bolao-surface)", padding: "18px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TeamSide name={translateTeamName(game.home_team)} logoUrl={game.home_team_logo} align="left" />
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            {showActual ? (
              <ScorePillStatic value={game.home_score} live={isLive} />
            ) : (
              <ScorePillInput value={homeInput} onChange={setHomeInput} />
            )}
            <span style={{
              fontFamily: '"FWC2026", system-ui, sans-serif',
              fontSize: 13, color: "var(--bolao-ink-faint)", fontWeight: 700,
            }}>v</span>
            {showActual ? (
              <ScorePillStatic value={game.away_score} live={isLive} />
            ) : (
              <ScorePillInput value={awayInput} onChange={setAwayInput} />
            )}
          </div>
          <TeamSide name={translateTeamName(game.away_team)} logoUrl={game.away_team_logo} align="right" />
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        background: "var(--bolao-surface)", borderTop: "1px solid var(--bolao-hairline)",
        padding: "12px 16px", display: "flex", flexDirection: "column", gap: 11,
      }}>
        {canEdit && (
          <>
            {hasOdds && (
              <OddsStrip
                homeTeam={translateTeamName(game.home_team)}
                awayTeam={translateTeamName(game.away_team)}
                homeProb={odds!.home_win_prob}
                drawProb={odds!.draw_prob}
                awayProb={odds!.away_win_prob}
              />
            )}
            {isKnockout && (
              <div style={saveState === "tieNoPick" ? { borderRadius: 12, boxShadow: "0 0 0 2px var(--bolao-lime)" } : {}}>
                <AdvancePicker
                  homeTeam={translateTeamName(game.home_team)}
                  awayTeam={translateTeamName(game.away_team)}
                  homeLogoUrl={game.home_team_logo}
                  awayLogoUrl={game.away_team_logo}
                  value={effectiveAdvancePick}
                  onChange={setAdvancePick}
                  disabled={scoredWinner !== null}
                />
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{
                fontSize: 12, color: saveState === "tieNoPick" ? "var(--bolao-lime)" : "var(--bolao-ink-faint)",
                fontFamily: '"Noto Sans", system-ui, sans-serif',
              }}>
                {saveState === "tieNoPick"
                  ? "Empate — escolha quem avança antes de salvar"
                  : isSaved
                    ? <span style={{ color: "var(--bolao-lime)" }}>Palpite salvo ✓</span>
                    : homeInput !== "" && awayInput !== ""
                      ? "Palpite preenchido — salve para confirmar"
                      : "Faça seu palpite acima"}
              </span>
              <button onClick={handleSave} style={{
                border: "none", borderRadius: 10, padding: "9px 18px",
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontSize: 13, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase",
                background: saveState === "invalid" || saveState === "tieNoPick" || saveState === "error"
                  ? "var(--bolao-red)" : "var(--bolao-lime)",
                color: saveState === "invalid" || saveState === "tieNoPick" || saveState === "error"
                  ? "#fff" : "var(--bolao-ink-dark)",
                whiteSpace: "nowrap",
              }}>
                {saveState === "saved" ? "✓ Salvo!" :
                 saveState === "tieNoPick" ? "Escolha quem avança!" :
                 saveState === "invalid" ? "Preencha o placar!" :
                 saveState === "error" ? "Erro!" : "Salvar"}
              </button>
            </div>
          </>
        )}

        {!canEdit && (
          <>
          {hasLockedOdds && (
            <LockedOddsStrip
              homeTeam={translateTeamName(game.home_team)}
              awayTeam={translateTeamName(game.away_team)}
              homeProb={game.locked_home_win_prob!}
              drawProb={game.locked_draw_prob!}
              awayProb={game.locked_away_win_prob!}
              winner={winner}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{
              fontSize: 12.5, color: "var(--bolao-ink-dim)",
              fontFamily: '"Noto Sans", system-ui, sans-serif',
            }}>
              Seu palpite{" "}
              <span style={{
                fontFamily: '"FWC2026", system-ui, sans-serif',
                color: "var(--bolao-ink)", fontWeight: 800, fontVariantNumeric: "tabular-nums",
              }}>
                {prediction?.home_score != null
                  ? `${prediction.home_score}–${prediction.away_score}` : "—"}
              </span>
              {isKnockout && prediction?.advance_pick && (
                <span style={{ color: "var(--bolao-ink-faint)", fontFamily: '"Noto Sans", system-ui, sans-serif', fontSize: 12 }}>
                  {" · "}
                  {prediction.advance_pick === "home"
                    ? translateTeamName(game.home_team)
                    : translateTeamName(game.away_team)} avança
                </span>
              )}
            </span>
            {isFinished && resultPts !== null && (
              <span style={{
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontSize: 15, fontWeight: 800, whiteSpace: "nowrap",
                color: resultPts > 0 ? "var(--bolao-lime)" : "var(--bolao-ink-faint)",
              }}>
                {resultPts > 0 ? `+${resultPts} pts` : "0 pts"}
              </span>
            )}
            {isLive && (
              <span style={{
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                color: "var(--bolao-red)", letterSpacing: "0.04em",
              }}>Em jogo</span>
            )}
          </div>
          {isFinished && (isExact || (isKnockout && prediction?.advance_pick != null)) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isExact && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontFamily: '"FWC2026", system-ui, sans-serif',
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
                  color: "var(--bolao-green-win)",
                  background: "rgba(1,230,118,0.08)",
                  border: "1px solid rgba(1,230,118,0.4)",
                  padding: "6px 12px 5px", borderRadius: 999,
                }}>🎯 Placar exato</span>
              )}
              {isKnockout && prediction?.advance_pick != null && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontFamily: '"FWC2026", system-ui, sans-serif',
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
                  color: isCorrectAdvance ? "var(--bolao-lime)" : "var(--bolao-red)",
                  background: isCorrectAdvance ? "rgba(1,230,118,0.08)" : "rgba(255,22,68,0.08)",
                  border: isCorrectAdvance ? "1px solid rgba(1,230,118,0.4)" : "1px solid rgba(255,22,68,0.4)",
                  padding: "6px 12px 5px", borderRadius: 999,
                }}>
                  {isCorrectAdvance ? "✓ Quem avança" : "✕ Quem avança"}
                </span>
              )}
            </div>
          )}
          </>
        )}

        {locked && (
          <GroupReveal
            gameId={game.id}
            homeTeam={translateTeamName(game.home_team)}
            awayTeam={translateTeamName(game.away_team)}
            homeScore={game.home_score}
            awayScore={game.away_score}
            isFinished={isFinished}
          />
        )}
      </div>
    </div>
  );
}
