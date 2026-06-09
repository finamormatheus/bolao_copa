"use client";

import { useState } from "react";
import { probabilityToPoints } from "@/lib/scoring/calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SimuladorPontos() {
  const [probability, setProbability] = useState(50);

  const basePoints = probabilityToPoints(probability / 100);
  const exactTotal = basePoints + 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Simulador de pontos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Probabilidade do resultado que você apostou
            </span>
            <span className="font-mono font-medium">{probability}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={99}
            value={probability}
            onChange={(e) => setProbability(Number(e.target.value))}
            className="w-full accent-foreground"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1% — azarão extremo</span>
            <span>99% — favorito absoluto</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 text-center space-y-1">
            <p className="text-xs text-muted-foreground">Acertou o resultado</p>
            <p className="text-3xl font-bold">{basePoints}</p>
            <p className="text-xs text-muted-foreground">pontos</p>
          </div>
          <div className="rounded-lg border p-3 text-center space-y-1 bg-muted/40">
            <p className="text-xs text-muted-foreground">
              Acertou o placar exato
            </p>
            <p className="text-3xl font-bold">
              {basePoints}
              <span className="text-lg text-muted-foreground font-normal">
                {" "}
                +5
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{exactTotal} pontos</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Quanto menor a probabilidade (resultado mais improvável), mais pontos
          você ganha ao acertar.
        </p>
      </CardContent>
    </Card>
  );
}
