"use client";

import { useState } from "react";
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
  const supabase = createClient();

  // Agrupa jogos por data
  const grouped = games.reduce<Record<string, Game[]>>((acc, game) => {
    const date = new Date(game.match_date).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(game);
    return acc;
  }, {});

  async function handleSave(gameId: string, home: number, away: number) {
    const { data, error } = await supabase
      .from("predictions")
      .upsert(
        {
          user_id: userId,
          game_id: gameId,
          home_score: home,
          away_score: away,
        },
        { onConflict: "user_id,game_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Erro ao salvar palpite:", error);
      throw new Error(error.message);
    }
    if (data) {
      setPredictions((prev) => {
        const without = prev.filter((p) => p.game_id !== gameId);
        return [...without, data];
      });
    }
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Nenhum jogo encontrado.</p>
        <p className="text-sm mt-1">Os jogos aparecerão aqui quando forem sincronizados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Meus Palpites</h1>
      {teams.length > 0 && (
        <ChampionPicker
          teams={teams}
          initialPick={championPick}
          locked={championLocked}
        />
      )}
      {Object.entries(grouped).map(([date, dateGames]) => (
        <section key={date} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {date}
          </h2>
          <div className="space-y-3">
            {dateGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                odds={odds.find((o) => o.game_id === game.id) ?? null}
                prediction={predictions.find((p) => p.game_id === game.id) ?? null}
                score={scores.find((s) => s.game_id === game.id) ?? null}
                onSave={handleSave}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
