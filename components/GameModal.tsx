"use client";

import { useState, useEffect, useTransition } from "react";
import type { Game, Odds, Prediction, GameScore } from "@/lib/supabase/types";
import { probabilityToPoints } from "@/lib/scoring/calculator";
import { translateTeamName, TEAM_FLAGS } from "@/lib/translations/teams";
import { AdvancePicker } from "./GameCard";
import { GroupReveal } from "./GroupReveal";

/* ---- helpers (duplicated from GameCard to avoid deep coupling) ---- */

const STAGE_PT: Record<string, string> = {
  "Group Stage": "Fase de Grupos",
  "Round of 32": "Rodada de 32", r32: "Rodada de 32", last_32: "Rodada de 32", LAST_32: "Rodada de 32",
  "Round of 16": "Oitavas de final", r16: "Oitavas de final", last_16: "Oitavas de final", LAST_16: "Oitavas de final",
  "Quarter-finals": "Quartas de final", qf: "Quartas de final",
  "Semi-finals": "Semi final", sf: "Semi final",
  "3rd Place": "Terceiro lugar", third: "Terceiro lugar",
  Final: "Final",
};

const LOCK_MINUTES = 5;
const KNOCKOUT_STAGES = new Set([
  "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final", "3rd Place",
  "r32", "r16", "qf", "sf", "third", "last_32", "last_16", "LAST_32", "LAST_16",
]);

function isWithinLock(dateStr: string) {
  return new Date(dateStr).getTime() - Date.now() <= LOCK_MINUTES * 60_000;
}

function fmtDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function outcome(h: number, a: number): "home" | "draw" | "away" {
  return h > a ? "home" : a > h ? "away" : "draw";
}

function FlagChip({ teamName, logoUrl, size = 46 }: { teamName: string; logoUrl: string | null; size?: number }) {
  const slug = TEAM_FLAGS[teamName] ?? null;
  const h = Math.round(size * 0.68);
  const big = Math.max(6, Math.round(size * 0.3));
  const sm = Math.max(2, Math.round(size * 0.085));
  const src = slug ? `/flags/regular/${slug}.png` : logoUrl;
  return (
    <span style={{
      width: size, height: h, borderRadius: `${big}px ${sm}px ${big}px ${sm}px`,
      overflow: "hidden", flexShrink: 0, display: "inline-block",
      border: "1.5px solid rgba(247,247,248,0.92)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.45)", background: "var(--bolao-surface-3)",
    }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={teamName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
      ) : (
        <span style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "var(--bolao-ink-dim)" }}>
          {teamName.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function ScorePillInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="numeric" maxLength={2} value={value} placeholder="–"
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
      style={{
        width: 54, height: 50, borderRadius: 12, border: "none",
        background: "var(--bolao-pill)", color: "var(--bolao-ink-dark)",
        textAlign: "center", fontSize: 28, fontWeight: 800,
        fontFamily: '"FWC2026", system-ui, sans-serif',
        padding: 0, outline: "none", boxShadow: "0 0 0 2px transparent",
        transition: "box-shadow .15s ease", fontVariantNumeric: "tabular-nums",
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
      fontSize: 28, fontWeight: 800, fontFamily: '"FWC2026", system-ui, sans-serif',
      boxShadow: live ? "0 0 0 2px var(--bolao-red)" : "none",
      fontVariantNumeric: "tabular-nums",
    }}>
      {value ?? "–"}
    </span>
  );
}

function OddsStrip({ homeTeam, awayTeam, homeProb, drawProb, awayProb }: {
  homeTeam: string; awayTeam: string;
  homeProb: number; drawProb: number; awayProb: number;
}) {
  const cells = [
    { label: homeTeam, prob: homeProb },
    { label: "Empate", prob: drawProb },
    { label: awayTeam, prob: awayProb },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {cells.map((c, i) => (
        <div key={i} style={{
          flex: 1, textAlign: "center", padding: "7px 6px",
          background: "rgba(247,247,248,0.04)", borderRadius: 10,
          border: "1px solid var(--bolao-hairline)",
        }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--bolao-ink-faint)", letterSpacing: "0.05em", fontFamily: '"Noto Sans", system-ui, sans-serif' }}>{c.label}</div>
          <div style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 15, fontWeight: 800, marginTop: 1, color: "var(--bolao-ink)" }}>{Math.round(c.prob * 100)}%</div>
          <div style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 10.5, color: "var(--bolao-lime)", fontWeight: 700 }}>+{probabilityToPoints(c.prob)} pts</div>
        </div>
      ))}
    </div>
  );
}

function LockedOddsStrip({ homeTeam, awayTeam, homeProb, drawProb, awayProb, winner }: {
  homeTeam: string; awayTeam: string;
  homeProb: number; drawProb: number; awayProb: number;
  winner: "home" | "draw" | "away" | null;
}) {
  const cells: { label: string; prob: number; key: "home" | "draw" | "away" }[] = [
    { label: homeTeam, prob: homeProb, key: "home" },
    { label: "Empate", prob: drawProb, key: "draw" },
    { label: awayTeam, prob: awayProb, key: "away" },
  ];
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--bolao-ink-faint)", letterSpacing: "0.05em", fontFamily: '"Noto Sans", system-ui, sans-serif', marginBottom: 6 }}>🔒 Odds no fechamento</div>
      <div style={{ display: "flex", gap: 8 }}>
        {cells.map((c) => {
          const isWinner = winner === c.key;
          const isLoser = winner !== null && !isWinner;
          return (
            <div key={c.key} style={{
              flex: 1, textAlign: "center", padding: "7px 6px",
              background: isWinner ? "rgba(1,230,118,0.08)" : "rgba(247,247,248,0.04)",
              borderRadius: 10,
              border: isWinner ? "1px solid rgba(1,230,118,0.45)" : "1px solid var(--bolao-hairline)",
              opacity: isLoser ? 0.4 : 1,
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: isWinner ? "var(--bolao-lime)" : "var(--bolao-ink-faint)", letterSpacing: "0.05em", fontFamily: '"Noto Sans", system-ui, sans-serif' }}>{c.label}</div>
              <div style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 15, fontWeight: 800, marginTop: 1, color: isWinner ? "var(--bolao-lime)" : "var(--bolao-ink-dim)" }}>{Math.round(c.prob * 100)}%</div>
              <div style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 10.5, fontWeight: 700, color: isWinner ? "var(--bolao-lime)" : "var(--bolao-ink-faint)" }}>+{probabilityToPoints(c.prob)} pts</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- main component ---- */

interface GameModalProps {
  game: Game;
  odds: Odds | null;
  prediction: Prediction | null;
  score: GameScore | null;
  onSave: (gameId: string, home: number, away: number, advancePick?: "home" | "away" | null) => Promise<void>;
  onClose: () => void;
}

export default function GameModal({ game, odds, prediction, score, onSave, onClose }: GameModalProps) {
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
  const homeTeam = translateTeamName(game.home_team);
  const awayTeam = translateTeamName(game.away_team);
  const isTBD = game.home_team === "TBD" || game.away_team === "TBD" ||
    game.home_team === "A definir" || game.away_team === "A definir";

  useEffect(() => {
    const check = () => setWithinLock(isWithinLock(game.match_date));
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [game.match_date]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isFinished = ["FT", "AET", "PEN", "FINISHED"].includes(game.status);
  const isLive = ["LIVE", "1H", "HT", "2H", "ET", "BT", "P", "PAUSED"].includes(game.status);
  const locked = isFinished || isLive || withinLock;
  const canEdit = !locked && !isTBD;
  const showActual = isLive || isFinished;

  const breakdown = isFinished && score
    ? (score.breakdown as { exact?: boolean; correctAdvance?: boolean } | null)
    : null;
  const isExact = !!(breakdown?.exact);
  const isCorrectAdvance = !!(breakdown?.correctAdvance);
  const resultPts = isFinished && score ? score.total_points : null;

  const hasOdds = !!(odds?.home_win_prob && odds?.draw_prob && odds?.away_win_prob);
  const hasLockedOdds = !!(game.locked_home_win_prob && game.locked_draw_prob && game.locked_away_win_prob);
  const winner: "home" | "draw" | "away" | null =
    isFinished && game.home_score !== null && game.away_score !== null
      ? outcome(game.home_score, game.away_score) : null;

  const { date, time } = fmtDateTime(game.match_date);

  function handleSave() {
    if (homeInput === "" || awayInput === "") { setSaveState("invalid"); setTimeout(() => setSaveState("idle"), 1800); return; }
    const home = parseInt(homeInput);
    const away = parseInt(awayInput);
    if (isNaN(home) || isNaN(away)) { setSaveState("invalid"); setTimeout(() => setSaveState("idle"), 1800); return; }
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

  const stageLabel = game.stage ? (STAGE_PT[game.stage] ?? game.stage) : null;
  const statusLabel = isTBD ? "A definir" : isFinished ? "Encerrado" : isLive ? "Ao vivo" : locked ? "Travado" : "Aberto";
  const statusColor = isTBD ? "var(--bolao-ink-faint)" : isFinished ? "var(--bolao-ink-faint)" : isLive ? "var(--bolao-red)" : locked ? "var(--bolao-ink-faint)" : "var(--bolao-lime)";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(5,5,8,0.72)",
        backdropFilter: "blur(4px)", zIndex: 50,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 16px 40px",
        overflowY: "auto",
        animation: "bolaoFade .15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460,
          background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline-2)",
          borderRadius: 22, boxShadow: "0 30px 80px -20px rgba(0,0,0,0.9)",
          animation: "bolaoPop .18s ease",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div style={{
          background: "var(--bolao-surface-2)", padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 12, fontWeight: 800, color: "var(--bolao-ink-dim)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {date} · {time}
            </span>
            {stageLabel && (
              <>
                <span style={{ width: 4, height: 4, borderRadius: 99, background: "var(--bolao-hairline-2)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--bolao-ink-dim)", fontFamily: '"Noto Sans", system-ui, sans-serif', whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stageLabel}</span>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{
              fontFamily: '"FWC2026", system-ui, sans-serif',
              fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
              color: statusColor, padding: "4px 9px", borderRadius: 999,
              background: `${statusColor}18`,
            }}>{statusLabel}</span>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--bolao-ink-faint)", fontSize: 18, lineHeight: 1, padding: "2px 4px",
            }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* TBD mode */}
          {isTBD && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ margin: "0 0 6px", fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 16, fontWeight: 800, color: "var(--bolao-ink)", textTransform: "uppercase" }}>Confronto a definir</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--bolao-ink-faint)", fontFamily: '"Noto Sans", system-ui, sans-serif' }}>Os times serão definidos após os confrontos anteriores.</p>
            </div>
          )}

          {/* Teams + scores */}
          {!isTBD && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Home */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <FlagChip teamName={homeTeam} logoUrl={game.home_team_logo} size={46} />
                <span style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--bolao-ink)", textAlign: "center", letterSpacing: "0.01em" }}>{homeTeam}</span>
              </div>
              {/* Scores */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                {showActual ? (
                  <ScorePillStatic value={game.home_score} live={isLive} />
                ) : (
                  <ScorePillInput value={homeInput} onChange={setHomeInput} />
                )}
                <span style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 13, color: "var(--bolao-ink-faint)", fontWeight: 700 }}>v</span>
                {showActual ? (
                  <ScorePillStatic value={game.away_score} live={isLive} />
                ) : (
                  <ScorePillInput value={awayInput} onChange={setAwayInput} />
                )}
              </div>
              {/* Away */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <FlagChip teamName={awayTeam} logoUrl={game.away_team_logo} size={46} />
                <span style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--bolao-ink)", textAlign: "center", letterSpacing: "0.01em" }}>{awayTeam}</span>
              </div>
            </div>
          )}

          {/* Edit mode */}
          {canEdit && (
            <>
              {hasOdds && (
                <OddsStrip homeTeam={homeTeam} awayTeam={awayTeam} homeProb={odds!.home_win_prob} drawProb={odds!.draw_prob} awayProb={odds!.away_win_prob} />
              )}
              {isKnockout && (
                <div style={saveState === "tieNoPick" ? { borderRadius: 12, boxShadow: "0 0 0 2px var(--bolao-lime)" } : {}}>
                  <AdvancePicker
                    homeTeam={homeTeam} awayTeam={awayTeam}
                    homeLogoUrl={game.home_team_logo} awayLogoUrl={game.away_team_logo}
                    value={effectiveAdvancePick} onChange={setAdvancePick}
                    disabled={scoredWinner !== null}
                  />
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12, color: saveState === "tieNoPick" ? "var(--bolao-lime)" : "var(--bolao-ink-faint)", fontFamily: '"Noto Sans", system-ui, sans-serif' }}>
                  {saveState === "tieNoPick"
                    ? "Empate — escolha quem avança antes de salvar"
                    : homeInput !== "" && awayInput !== "" && (!isKnockout || advancePick !== null)
                      ? "Palpite preenchido — salve para confirmar"
                      : isKnockout ? "Preencha o placar e quem avança" : "Faça seu palpite acima"}
                </span>
                <button onClick={handleSave} style={{
                  border: "none", borderRadius: 10, padding: "9px 18px",
                  fontFamily: '"FWC2026", system-ui, sans-serif',
                  fontSize: 13, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase",
                  background: saveState === "invalid" || saveState === "tieNoPick" || saveState === "error" ? "var(--bolao-red)" : "var(--bolao-lime)",
                  color: saveState === "invalid" || saveState === "tieNoPick" || saveState === "error" ? "#fff" : "var(--bolao-ink-dark)",
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

          {/* Locked / result mode */}
          {!canEdit && !isTBD && (
            <>
              {hasLockedOdds && (
                <LockedOddsStrip homeTeam={homeTeam} awayTeam={awayTeam} homeProb={game.locked_home_win_prob!} drawProb={game.locked_draw_prob!} awayProb={game.locked_away_win_prob!} winner={winner} />
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12.5, color: "var(--bolao-ink-dim)", fontFamily: '"Noto Sans", system-ui, sans-serif' }}>
                  Seu palpite{" "}
                  <span style={{ fontFamily: '"FWC2026", system-ui, sans-serif', color: "var(--bolao-ink)", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    {prediction?.home_score != null ? `${prediction.home_score}–${prediction.away_score}` : "—"}
                  </span>
                  {isKnockout && prediction?.advance_pick && (
                    <span style={{ color: "var(--bolao-ink-faint)", fontFamily: '"Noto Sans", system-ui, sans-serif', fontSize: 12 }}>
                      {" · "}
                      {prediction.advance_pick === "home" ? homeTeam : awayTeam} avança
                    </span>
                  )}
                </span>
                {isFinished && resultPts !== null && (
                  <span style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 15, fontWeight: 800, color: resultPts > 0 ? "var(--bolao-lime)" : "var(--bolao-ink-faint)", whiteSpace: "nowrap" }}>
                    {resultPts > 0 ? `+${resultPts} pts` : "0 pts"}
                  </span>
                )}
                {isLive && <span style={{ fontFamily: '"FWC2026", system-ui, sans-serif', fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--bolao-red)", letterSpacing: "0.04em" }}>Em jogo</span>}
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

          {/* Group reveal */}
          {locked && !isTBD && (
            <GroupReveal gameId={game.id} homeTeam={homeTeam} awayTeam={awayTeam} homeScore={game.home_score} awayScore={game.away_score} isFinished={isFinished} />
          )}
        </div>
      </div>
    </div>
  );
}
