"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Game, Odds, Prediction, GameScore } from "@/lib/supabase/types";

interface GameCardProps {
  game: Game;
  odds: Odds | null;
  prediction: Prediction | null;
  score: GameScore | null;
  onSave: (gameId: string, home: number, away: number) => Promise<void>;
}

const LOCK_MINUTES = 5;

function isLocked(matchDate: string): boolean {
  const diff = new Date(matchDate).getTime() - Date.now();
  return diff <= LOCK_MINUTES * 60 * 1000;
}

function formatMatchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string): { label: string; variant: "default" | "secondary" | "outline" } {
  if (status === "NS") return { label: "Não iniciado", variant: "outline" };
  if (["1H", "2H", "ET"].includes(status)) return { label: "Ao vivo", variant: "default" };
  if (status === "HT") return { label: "Intervalo", variant: "secondary" };
  if (["FT", "AET", "PEN"].includes(status)) return { label: "Encerrado", variant: "secondary" };
  return { label: status, variant: "outline" };
}

function OddsBar({ label, prob }: { label: string; prob: number | null }) {
  if (!prob) return null;
  return (
    <div className="text-center text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{(prob * 100).toFixed(0)}%</div>
    </div>
  );
}

export default function GameCard({ game, odds, prediction, score, onSave }: GameCardProps) {
  const locked = isLocked(game.match_date);
  const isFinished = ["FT", "AET", "PEN"].includes(game.status);
  const isLive = ["1H", "HT", "2H", "ET", "BT", "P"].includes(game.status);

  const [homeInput, setHomeInput] = useState(
    prediction?.home_score?.toString() ?? ""
  );
  const [awayInput, setAwayInput] = useState(
    prediction?.away_score?.toString() ?? ""
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const canEdit = !locked && !isLive && !isFinished;

  function handleSave() {
    const home = parseInt(homeInput);
    const away = parseInt(awayInput);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) return;
    startTransition(async () => {
      await onSave(game.id, home, away);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const { label, variant } = statusLabel(game.status);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header: stage + status + date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{game.group_name ?? game.stage}</span>
          <div className="flex items-center gap-2">
            <Badge variant={variant} className="text-xs">{label}</Badge>
            <span>{formatMatchDate(game.match_date)}</span>
          </div>
        </div>

        {/* Teams + score */}
        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {game.home_team_logo && (
              <img
                src={game.home_team_logo}
                alt={game.home_team}
                className="shrink-0 h-5 w-auto"
              />
            )}
            <span className="font-medium text-sm truncate">{game.home_team}</span>
          </div>

          {/* Scoreboard */}
          <div className="flex items-center gap-2 shrink-0">
            {(isFinished || isLive) && game.home_score !== null ? (
              <span className="text-xl font-bold tabular-nums">
                {game.home_score} – {game.away_score}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">vs</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="font-medium text-sm truncate text-right">{game.away_team}</span>
            {game.away_team_logo && (
              <img
                src={game.away_team_logo}
                alt={game.away_team}
                className="shrink-0 h-5 w-auto"
              />
            )}
          </div>
        </div>

        {/* Odds bar */}
        {odds && (
          <div className="flex justify-between px-1 pt-1 border-t">
            <OddsBar label={game.home_team.split(" ")[0]} prob={odds.home_win_prob} />
            <OddsBar label="Empate" prob={odds.draw_prob} />
            <OddsBar label={game.away_team.split(" ")[0]} prob={odds.away_win_prob} />
          </div>
        )}

        {/* Prediction input or result */}
        <div className="border-t pt-3">
          {isFinished && score ? (
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Seu palpite:{" "}
                <span className="font-medium text-foreground">
                  {prediction?.home_score ?? "–"} – {prediction?.away_score ?? "–"}
                </span>
              </div>
              <div className="font-semibold text-green-600 dark:text-green-400">
                +{score.total_points} pts
              </div>
            </div>
          ) : canEdit ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground flex-1">Palpite:</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min="0"
                  max="99"
                  className="w-12 h-8 text-center px-1"
                  value={homeInput}
                  onChange={(e) => setHomeInput(e.target.value)}
                  placeholder="0"
                />
                <span className="text-muted-foreground font-medium">–</span>
                <Input
                  type="number"
                  min="0"
                  max="99"
                  className="w-12 h-8 text-center px-1"
                  value={awayInput}
                  onChange={(e) => setAwayInput(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button
                size="sm"
                className="h-8"
                onClick={handleSave}
                disabled={isPending || !homeInput || !awayInput}
              >
                {saved ? "Salvo!" : isPending ? "..." : "Salvar"}
              </Button>
            </div>
          ) : prediction ? (
            <div className="text-sm text-muted-foreground">
              Palpite:{" "}
              <span className="font-medium text-foreground">
                {prediction.home_score} – {prediction.away_score}
              </span>
              {locked && !isFinished && (
                <span className="ml-2 text-xs">(travado)</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {locked ? "Palpites encerrados" : "Sem palpite"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
