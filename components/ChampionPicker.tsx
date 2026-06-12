"use client";

import { useState, useRef, useEffect } from "react";
import type { ChampionPick } from "@/lib/supabase/types";
import { translateTeamName, TEAM_FLAGS } from "@/lib/translations/teams";

type ChampionGroupPick = {
  display_name: string;
  avatar_url: string | null;
  team_name: string | null;
  points_awarded: number;
  is_me: boolean;
};

const CHAMPION_POINTS = 20;

interface Props {
  teams: string[];
  initialPick: ChampionPick | null;
  locked: boolean;
}

function FlagChipSmall({ teamName, size = 26 }: { teamName: string; size?: number }) {
  const slug = TEAM_FLAGS[teamName] ?? null;
  if (!slug) return null;
  const h = Math.round(size * 0.68);
  const big = Math.max(4, Math.round(size * 0.3));
  const sm = Math.max(1, Math.round(size * 0.085));
  return (
    <span style={{
      width: size, height: h, display: "inline-block", flexShrink: 0,
      borderRadius: `${big}px ${sm}px ${big}px ${sm}px`,
      overflow: "hidden",
      border: "1.5px solid rgba(247,247,248,0.92)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
      background: "var(--bolao-surface-3)",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/flags/regular/${slug}.png`}
        alt={teamName}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        loading="lazy"
      />
    </span>
  );
}

export default function ChampionPicker({ teams, initialPick, locked }: Props) {
  const [pick, setPick] = useState<string | null>(initialPick?.team_name ?? null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [groupPicks, setGroupPicks] = useState<ChampionGroupPick[] | null | "loading">(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleExpand() {
    const wasExpanded = expanded;
    setExpanded((v) => !v);
    if (!wasExpanded && groupPicks === null) {
      setGroupPicks("loading");
      try {
        const res = await fetch("/api/group-champion-picks");
        const json = await res.json();
        setGroupPicks(res.ok ? json.picks : []);
      } catch {
        setGroupPicks([]);
      }
    }
  }

  async function handleSelect(team: string) {
    if (locked || saving) return;
    setOpen(false);
    setSearch("");
    setSaving(true);
    try {
      const res = await fetch("/api/champion-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_name: team }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Erro ao salvar (${res.status}): ${body?.error ?? "desconhecido"}`);
      }
      setPick(team);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const filtered = teams.filter((t) => {
    const q = search.toLowerCase();
    return t.toLowerCase().includes(q) || translateTeamName(t).toLowerCase().includes(q);
  });

  return (
    <div style={{
      borderRadius: "var(--bolao-radius-card)",
      position: "relative",
      background: "linear-gradient(180deg, rgba(232,163,14,0.10), rgba(232,163,14,0) 60%), var(--bolao-surface)",
      border: "1px solid rgba(232,163,14,0.28)",
    }}>
      {/* Main row */}
      <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        {/* Trophy */}
        <span style={{
          width: 34, height: 58, flexShrink: 0,
          backgroundImage: "url('/trophy.png')",
          backgroundSize: "auto 100%", backgroundPosition: "center", backgroundRepeat: "no-repeat",
          filter: "drop-shadow(0 4px 10px rgba(232,163,14,0.35))",
        }} aria-label="Taça FIFA World Cup" role="img" />

        {/* Title + points */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: '"FWC2026", system-ui, sans-serif',
            fontSize: 14, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase",
            color: "var(--bolao-ink)",
          }}>
            Campeão da Copa
          </div>
          <div style={{
            fontSize: 12, color: "var(--bolao-ink-dim)", marginTop: 2,
            fontFamily: '"Noto Sans", system-ui, sans-serif',
          }}>
            <span style={{ color: "var(--bolao-gold)", fontWeight: 700 }}>
              +{CHAMPION_POINTS} pts
            </span>{" "}
            {initialPick?.points_awarded ? "— Você acertou!" : "se você acertar o campeão"}
          </div>
        </div>

        {/* Picker button + dropdown */}
        <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => !locked && !saving && setOpen((v) => !v)}
            disabled={locked || saving}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: pick ? "var(--bolao-gold)" : "transparent",
              color: pick ? "var(--bolao-ink-dark)" : "var(--bolao-ink)",
              border: pick ? "none" : "1px solid var(--bolao-hairline-2)",
              borderRadius: 10, padding: "9px 14px",
              fontFamily: '"FWC2026", system-ui, sans-serif',
              fontSize: 13, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase",
              cursor: locked ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {pick && <FlagChipSmall teamName={translateTeamName(pick)} />}
            {saving ? "Salvando..." : (pick ? translateTeamName(pick) : "Escolher")}
            {!locked && <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>}
          </button>

          {open && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
              width: 220, maxHeight: 280, overflowY: "auto",
              background: "var(--bolao-surface-3)",
              border: "1px solid var(--bolao-hairline-2)",
              borderRadius: 12, padding: 6,
              boxShadow: "0 18px 40px -16px rgba(0,0,0,0.9)",
            }}>
              <div style={{ padding: "0 4px 6px" }}>
                <input
                  placeholder="Pesquisar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%", border: "1px solid var(--bolao-hairline-2)",
                    borderRadius: 8, padding: "6px 10px",
                    background: "var(--bolao-surface-2)", color: "var(--bolao-ink)",
                    fontSize: 13, outline: "none",
                    fontFamily: '"Noto Sans", system-ui, sans-serif',
                  }}
                />
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding: "8px 9px", fontSize: 13, color: "var(--bolao-ink-dim)", textAlign: "center" }}>
                  Nenhum país encontrado.
                </div>
              ) : (
                filtered.map((team) => (
                  <button
                    key={team}
                    onClick={() => handleSelect(team)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      background: pick === team ? "var(--bolao-lime-soft)" : "transparent",
                      border: "none", borderRadius: 8, padding: "8px 9px",
                      color: "var(--bolao-ink)", fontSize: 14, textAlign: "left",
                      fontFamily: '"Noto Sans", system-ui, sans-serif',
                    }}
                  >
                    <FlagChipSmall teamName={translateTeamName(team)} />
                    {translateTeamName(team)}
                    {pick === team && (
                      <span style={{ marginLeft: "auto", color: "var(--bolao-lime)" }}>✓</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Group picks — locked message before tournament starts, list after */}
      <div style={{ borderTop: "1px solid rgba(232,163,14,0.20)", padding: "10px 18px 14px" }}>
        {!locked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "1px 0" }}>
            <span style={{ fontSize: 13 }}>🔒</span>
            <span style={{ fontSize: 12.5, color: "var(--bolao-ink-faint)", fontFamily: '"Noto Sans", system-ui, sans-serif' }}>
              Os palpites de campeão do grupo são revelados quando a Copa começar.
            </span>
          </div>
        ) : (
          <>
            <button onClick={handleExpand} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", color: "var(--bolao-ink-dim)", padding: "2px 0",
              fontSize: 12.5, fontFamily: '"Noto Sans", system-ui, sans-serif', fontWeight: 600,
              cursor: "pointer",
            }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                {groupPicks === "loading" ? (
                  <span style={{
                    width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
                    border: "2px solid currentColor", borderTopColor: "transparent",
                    display: "inline-block", animation: "bolao-spin 0.6s linear infinite",
                  }} />
                ) : (
                  <span style={{ fontSize: 13 }}>🏆</span>
                )}
                Palpites de campeão do grupo
                {Array.isArray(groupPicks) && (
                  <span style={{ color: "var(--bolao-ink-faint)" }}>
                    · {groupPicks.filter((m) => m.team_name).length}
                  </span>
                )}
              </span>
              <span style={{ display: "inline-block", transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
            </button>

            {expanded && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                {groupPicks === "loading" ? (
                  <p style={{ fontSize: 12, color: "var(--bolao-ink-faint)", margin: 0 }}>Carregando...</p>
                ) : !groupPicks || groupPicks.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--bolao-ink-faint)", margin: 0 }}>Nenhum participante encontrado.</p>
                ) : (
                  groupPicks.map((gp, i) => {
                    const me = gp.is_me;
                    const initials = gp.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                    const teamToShow = me ? pick : gp.team_name;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: me ? "var(--bolao-lime-soft)" : "transparent",
                        borderRadius: 8, padding: me ? "5px 8px" : "5px 0",
                      }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: 99, flexShrink: 0,
                            background: me ? "var(--bolao-lime)" : "var(--bolao-surface-2)",
                            color: me ? "var(--bolao-ink-dark)" : "var(--bolao-ink)",
                            fontSize: 9.5, fontWeight: 800, fontFamily: '"FWC2026", system-ui, sans-serif',
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                          }}>{initials}</span>
                          <span style={{
                            fontSize: 13, color: me ? "var(--bolao-ink)" : "var(--bolao-ink-dim)",
                            fontWeight: me ? 700 : 500,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            fontFamily: '"Noto Sans", system-ui, sans-serif',
                          }}>{gp.display_name}</span>
                        </span>
                        {teamToShow ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                            <FlagChipSmall teamName={translateTeamName(teamToShow)} />
                            <span style={{
                              fontFamily: '"FWC2026", system-ui, sans-serif',
                              fontSize: 12.5, fontWeight: 800, textTransform: "uppercase",
                              color: me ? "var(--bolao-gold)" : "var(--bolao-ink-dim)",
                            }}>{translateTeamName(teamToShow)}</span>
                          </span>
                        ) : (
                          <span style={{ fontSize: 12.5, color: "var(--bolao-ink-faint)", fontFamily: '"Noto Sans", system-ui, sans-serif' }}>
                            sem palpite
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
