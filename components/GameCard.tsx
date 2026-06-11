"use client";

import { useState, useEffect, useTransition } from "react";
import type { Game, Odds, Prediction, GameScore } from "@/lib/supabase/types";
import { probabilityToPoints } from "@/lib/scoring/calculator";
import { translateTeamName, TEAM_FLAGS } from "@/lib/translations/teams";

/* ---- helpers ---- */

const GROUP_COLORS: Record<string, string> = {
  A: "rgb(1,230,118)", B: "rgb(255,22,68)", C: "rgb(255,145,3)",
  D: "rgb(48,79,254)", E: "rgb(98,0,234)", F: "rgb(199,255,2)",
  G: "rgb(240,98,146)", H: "rgb(100,255,218)", I: "rgb(171,71,188)",
  J: "rgb(0,120,136)", K: "rgb(255,61,0)", L: "rgb(33,150,243)",
};

const STAGE_PT: Record<string, string> = {
  "Group Stage":    "Fase de Grupos",
  "last_32":        "Rodada de 32",
  "LAST_32":        "Rodada de 32",
  "last_16":        "Oitavas de Final",
  "LAST_16":        "Oitavas de Final",
  "Round of 16":    "Oitavas de Final",
  "Quarter-finals": "Quartas de Final",
  "Semi-finals":    "Semifinal",
  "3rd Place":      "3º Lugar",
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

function outcome(h: number, a: number): "home" | "draw" | "away" {
  return h > a ? "home" : a > h ? "away" : "draw";
}

const LOCK_MINUTES = 5;
function isWithinLock(dateStr: string): boolean {
  return new Date(dateStr).getTime() - Date.now() <= LOCK_MINUTES * 60_000;
}

/* ---- sub-components ---- */

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

type GroupPick = {
  display_name: string;
  avatar_url: string | null;
  home_score: number | null;
  away_score: number | null;
};

function GroupReveal({ gameId, homeScore, awayScore, isFinished }: {
  gameId: string; homeScore: number | null; awayScore: number | null; isFinished: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<GroupPick[] | "loading" | null>(null);

  async function handleToggle() {
    if (!open && picks === null) {
      setPicks("loading");
      try {
        const res = await fetch(`/api/game-picks?gameId=${gameId}`);
        const json = await res.json();
        setPicks(res.ok ? json.picks : []);
      } catch {
        setPicks([]);
      }
    }
    setOpen((v) => !v);
  }

  const actualOutcome = isFinished && homeScore !== null && awayScore !== null
    ? outcome(homeScore, awayScore) : null;

  return (
    <div style={{ borderTop: "1px solid var(--bolao-hairline)", paddingTop: 10 }}>
      <button onClick={handleToggle} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "none", border: "none", color: "var(--bolao-ink-dim)", padding: "2px 0",
        fontSize: 12.5, fontFamily: '"Noto Sans", system-ui, sans-serif', fontWeight: 600,
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 13 }}>👥</span> Palpites do grupo
        </span>
        <span style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
          {picks === "loading" ? (
            <p style={{ fontSize: 12, color: "var(--bolao-ink-faint)", margin: 0 }}>Carregando...</p>
          ) : !picks || picks.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--bolao-ink-faint)", margin: 0 }}>Nenhum palpite encontrado.</p>
          ) : (
            picks.map((p, i) => {
              const initials = p.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              const hasGuess = p.home_score !== null && p.away_score !== null;
              const correct = actualOutcome && hasGuess
                ? outcome(p.home_score!, p.away_score!) === actualOutcome : false;
              const exact = correct && isFinished
                ? p.home_score === homeScore && p.away_score === awayScore : false;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderRadius: 8, padding: "4px 0",
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 99, flexShrink: 0,
                      background: "var(--bolao-surface-2)", color: "var(--bolao-ink)",
                      fontSize: 9.5, fontWeight: 800, fontFamily: '"FWC2026", system-ui, sans-serif',
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>{initials}</span>
                    <span style={{
                      fontSize: 13, color: "var(--bolao-ink-dim)", fontWeight: 500,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      fontFamily: '"Noto Sans", system-ui, sans-serif',
                    }}>{p.display_name}</span>
                  </span>
                  <span style={{
                    fontFamily: '"FWC2026", system-ui, sans-serif',
                    fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                    color: exact ? "var(--bolao-green-win)" : correct ? "var(--bolao-lime)" : "var(--bolao-ink-dim)",
                    display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                  }}>
                    {exact && <span style={{ fontSize: 11 }}>🎯</span>}
                    {hasGuess ? `${p.home_score}–${p.away_score}` : "—"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ---- main component ---- */

interface GameCardProps {
  game: Game;
  odds: Odds | null;
  prediction: Prediction | null;
  score: GameScore | null;
  onSave: (gameId: string, home: number, away: number) => Promise<void>;
  groupStripe?: boolean;
}

export default function GameCard({ game, odds, prediction, score, onSave, groupStripe = true }: GameCardProps) {
  const [homeInput, setHomeInput] = useState(prediction?.home_score?.toString() ?? "");
  const [awayInput, setAwayInput] = useState(prediction?.away_score?.toString() ?? "");
  const [, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "invalid" | "error">("idle");
  const [withinLock, setWithinLock] = useState(false);

  useEffect(() => {
    const check = () => setWithinLock(isWithinLock(game.match_date));
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [game.match_date]);

  const isFinished = ["FT", "AET", "PEN"].includes(game.status);
  const isLive = ["LIVE", "1H", "HT", "2H", "ET", "BT", "P"].includes(game.status);
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
    startTransition(async () => {
      try {
        await onSave(game.id, home, away);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1800);
      } catch {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    });
  }

  const resultPts = isFinished && score ? score.total_points : null;
  const isExact = isFinished && score
    ? !!(score.breakdown as { exact?: boolean } | null)?.exact : false;

  const group = groupLetter(game.group_name);
  const groupColor = group ? (GROUP_COLORS[group] ?? null) : null;
  const hasOdds = !!(odds?.home_win_prob && odds?.draw_prob && odds?.away_win_prob);

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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{
                fontSize: 12, color: "var(--bolao-ink-faint)",
                fontFamily: '"Noto Sans", system-ui, sans-serif',
              }}>
                {homeInput !== "" && awayInput !== ""
                  ? "Palpite preenchido — salve para confirmar"
                  : "Faça seu palpite acima"}
              </span>
              <button onClick={handleSave} style={{
                border: "none", borderRadius: 10, padding: "9px 18px",
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontSize: 13, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase",
                background: saveState === "invalid" || saveState === "error"
                  ? "var(--bolao-red)" : "var(--bolao-lime)",
                color: saveState === "invalid" || saveState === "error"
                  ? "#fff" : "var(--bolao-ink-dark)",
                whiteSpace: "nowrap",
              }}>
                {saveState === "saved" ? "✓ Salvo!" :
                 saveState === "invalid" ? "Preencha!" :
                 saveState === "error" ? "Erro!" : "Salvar"}
              </button>
            </div>
          </>
        )}

        {!canEdit && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{
              fontSize: 12.5, color: "var(--bolao-ink-dim)", whiteSpace: "nowrap",
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
            </span>
            {isFinished && resultPts !== null && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {isExact && (
                  <span style={{
                    fontFamily: '"FWC2026", system-ui, sans-serif',
                    fontSize: 10.5, fontWeight: 800, textTransform: "uppercase",
                    color: "var(--bolao-green-win)", letterSpacing: "0.04em",
                  }}>🎯 Cravou!</span>
                )}
                <span style={{
                  fontFamily: '"FWC2026", system-ui, sans-serif',
                  fontSize: 15, fontWeight: 800,
                  color: resultPts > 0 ? "var(--bolao-lime)" : "var(--bolao-ink-faint)",
                }}>
                  {resultPts > 0 ? `+${resultPts} pts` : "0 pts"}
                </span>
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
        )}

        {locked && (
          <GroupReveal
            gameId={game.id}
            homeScore={game.home_score}
            awayScore={game.away_score}
            isFinished={isFinished}
          />
        )}
      </div>
    </div>
  );
}
