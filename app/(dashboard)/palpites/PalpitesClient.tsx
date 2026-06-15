"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import GameCard from "@/components/GameCard";
import ChampionPicker from "@/components/ChampionPicker";
import type { Game, Odds, Prediction, GameScore, ChampionPick } from "@/lib/supabase/types";

interface Props {
  userId: string;
  games: Game[];
  odds: Odds[];
  predictions: Prediction[];
  scores: GameScore[];
  championPick: ChampionPick | null;
  championLocked: boolean;
  teams: string[];
}

type View = "crono" | "grupos" | "encerrados";

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "FINISHED"]);

function isGameFinished(game: Game) {
  return FINISHED_STATUSES.has(game.status);
}

function groupLetter(groupName: string | null): string {
  if (!groupName) return "?";
  const m = groupName.match(/\b([A-L])\b/i);
  return m ? m[1].toUpperCase() : "?";
}

const GROUP_COLORS: Record<string, string> = {
  A: "rgb(1,230,118)", B: "rgb(255,22,68)", C: "rgb(255,145,3)",
  D: "rgb(48,79,254)", E: "rgb(98,0,234)", F: "rgb(199,255,2)",
  G: "rgb(240,98,146)", H: "rgb(100,255,218)", I: "rgb(171,71,188)",
  J: "rgb(0,120,136)", K: "rgb(255,61,0)", L: "rgb(33,150,243)",
};

export default function PalpitesClient({
  userId,
  games,
  odds,
  predictions: initialPredictions,
  scores,
  championPick,
  championLocked,
  teams,
}: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>(initialPredictions);
  const [view, setView] = useState<View>("crono");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("bolao_view") as View | null;
      if (stored) setView(stored);
    } catch { /* noop */ }
  }, []);
  const supabase = createClient();

  function handleViewChange(v: View) {
    setView(v);
    try { localStorage.setItem("bolao_view", v); } catch { /* noop */ }
  }

  async function handleSave(gameId: string, home: number, away: number) {
    const { data, error } = await supabase
      .from("predictions")
      .upsert(
        { user_id: userId, game_id: gameId, home_score: home, away_score: away },
        { onConflict: "user_id,game_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Erro ao salvar palpite:", error);
      throw new Error(error.message);
    }
    if (data) {
      setPredictions((prev) => [...prev.filter((p) => p.game_id !== gameId), data]);
    }
  }

  if (games.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0", color: "var(--bolao-ink-dim)" }}>
        <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>Nenhum jogo encontrado.</p>
        <p style={{ fontSize: 13, margin: 0 }}>Os jogos aparecerão aqui quando forem sincronizados.</p>
      </div>
    );
  }

  const sorted = [...games].sort(
    (a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
  );

  // Build sections based on view
  type Section =
    | { kind: "date"; key: string; label: string; items: Game[] }
    | { kind: "group"; key: string; group: string; items: Game[] };

  let sections: Section[] = [];

  if (view === "crono") {
    const activeGames = sorted.filter((g) => !isGameFinished(g));
    const map = new Map<string, Game[]>();
    for (const g of activeGames) {
      const label = new Date(g.match_date).toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long",
      });
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(g);
    }
    sections = Array.from(map.entries()).map(([label, items]) => ({
      kind: "date", key: label, label, items,
    }));
  } else if (view === "grupos") {
    const activeGames = sorted.filter((g) => !isGameFinished(g));
    const map = new Map<string, Game[]>();
    for (const g of activeGames) {
      const letter = groupLetter(g.group_name);
      if (letter === "?") continue;
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(g);
    }
    const sorted_groups = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    sections = sorted_groups.map(([group, items]) => ({
      kind: "group", key: group, group, items,
    }));
  } else {
    // encerrados — reverse chronological, grouped by date
    const finishedGames = sorted.filter(isGameFinished).reverse();
    const map = new Map<string, Game[]>();
    for (const g of finishedGames) {
      const label = new Date(g.match_date).toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long",
      });
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(g);
    }
    sections = Array.from(map.entries()).map(([label, items]) => ({
      kind: "date", key: label, label, items,
    }));
  }

  const VIEW_LABELS: Record<View, string> = {
    crono: "Cronológico",
    grupos: "Por grupo",
    encerrados: "Encerrados",
  };

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{
          margin: "0 0 3px",
          fontFamily: '"FWC2026", system-ui, sans-serif',
          fontSize: 30, fontWeight: 800, letterSpacing: "-0.01em", textTransform: "uppercase",
          color: "var(--bolao-ink)",
        }}>
          Meus Palpites
        </h1>
        <p style={{
          margin: 0, fontSize: 13.5, color: "var(--bolao-ink-dim)",
          fontFamily: '"Noto Sans", system-ui, sans-serif',
        }}>
          Fase de grupos · Palpites travam 5 min antes de cada jogo
        </p>
      </div>

      {/* Champion picker */}
      {teams.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <ChampionPicker teams={teams} initialPick={championPick} locked={championLocked} />
        </div>
      )}

      {/* View toggle */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          display: "flex", padding: 4, gap: 4, borderRadius: 12,
          background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)",
        }}>
          {(["crono", "grupos", "encerrados"] as const).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                style={{
                  flex: 1, border: "none", borderRadius: 9, padding: "8px 10px",
                  fontFamily: '"FWC2026", system-ui, sans-serif',
                  fontSize: 12.5, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase",
                  background: active ? "var(--bolao-lime)" : "transparent",
                  color: active ? "var(--bolao-ink-dark)" : "var(--bolao-ink-dim)",
                  cursor: "pointer", textAlign: "center", lineHeight: 1.2,
                }}
              >
                {VIEW_LABELS[v]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {sections.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--bolao-ink-dim)" }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>
            {view === "encerrados" ? "Nenhum jogo encerrado ainda." : "Nenhum jogo pendente."}
          </p>
        </div>
      )}

      {/* Sections */}
      {sections.map((s) => (
        <section key={s.key} style={{ marginBottom: 22 }}>
          {s.kind === "date" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 2px 12px" }}>
              <span style={{
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontSize: 12.5, fontWeight: 800, color: "var(--bolao-ink-dim)",
                letterSpacing: "0.08em", whiteSpace: "nowrap", textTransform: "uppercase",
              }}>{s.label}</span>
              <span style={{ flex: 1, height: 1, background: "var(--bolao-hairline)" }} />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 2px 12px" }}>
              <span style={{
                background: GROUP_COLORS[s.group] ?? "rgba(247,247,248,0.2)",
                color: "var(--bolao-ink-dark)",
                fontFamily: '"FWC2026", system-ui, sans-serif',
                fontWeight: 800, fontSize: 13, lineHeight: 1,
                padding: "6px 12px 5px", borderRadius: 999,
                letterSpacing: "0.02em", whiteSpace: "nowrap", textTransform: "uppercase",
              }}>Grupo {s.group}</span>
              <span style={{
                fontSize: 12, color: "var(--bolao-ink-faint)",
                fontFamily: '"Noto Sans", system-ui, sans-serif',
                whiteSpace: "nowrap",
              }}>
                {s.items.length} {s.items.length === 1 ? "jogo" : "jogos"}
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--bolao-hairline)" }} />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {s.items.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                odds={odds.find((o) => o.game_id === game.id) ?? null}
                prediction={predictions.find((p) => p.game_id === game.id) ?? null}
                score={scores.find((sc) => sc.game_id === game.id) ?? null}
                onSave={handleSave}
                showDate={view === "grupos"}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
