"use client";

import { useState } from "react";
import { probabilityToPoints } from "@/lib/scoring/calculator";

const DISPLAY = '"FWC2026", system-ui, sans-serif';
const UI = "system-ui, sans-serif";
const EXACT_BONUS = 5;

export default function SimuladorPontos() {
  const [prob, setProb] = useState(50);

  const basePoints = probabilityToPoints(prob / 100);
  const exactTotal = basePoints + EXACT_BONUS;

  return (
    <div style={{
      background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)",
      borderRadius: 18, padding: "20px 18px", marginTop: 12,
    }}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em", color: "var(--bolao-ink-dim)", textTransform: "uppercase", fontFamily: DISPLAY }}>Simulador</span>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--bolao-ink-dim)", fontFamily: UI }}>
          Arraste para ver quanto vale acertar cada resultado.
        </p>
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--bolao-ink-faint)", textTransform: "uppercase", fontFamily: UI }}>Zebra</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--bolao-lime)", fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>
            {prob}% de chance
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--bolao-ink-faint)", textTransform: "uppercase", fontFamily: UI }}>Favorito</span>
        </div>
        <input
          type="range"
          min={1}
          max={99}
          value={prob}
          onChange={(e) => setProb(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--bolao-lime)", cursor: "pointer", display: "block" }}
        />
      </div>

      {/* Points display */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, background: "var(--bolao-surface-3)", border: "1px solid var(--bolao-hairline)", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", color: "var(--bolao-ink-faint)", fontFamily: UI, textTransform: "uppercase", marginBottom: 10 }}>Acertou o resultado</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "center" }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: "var(--bolao-lime)", fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>+{basePoints}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--bolao-ink-faint)", textTransform: "uppercase", fontFamily: DISPLAY }}>pts</span>
          </div>
        </div>
        <div style={{ flex: 1, background: "var(--bolao-surface-3)", border: "1px solid var(--bolao-hairline)", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", color: "var(--bolao-ink-faint)", fontFamily: UI, textTransform: "uppercase", marginBottom: 10 }}>Com cravada</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "center" }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: "var(--bolao-ink)", fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>+{exactTotal}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--bolao-ink-faint)", textTransform: "uppercase", fontFamily: DISPLAY }}>pts</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--bolao-ink-faint)", fontFamily: UI, marginTop: 5 }}>
            {basePoints} resultado + {EXACT_BONUS} cravada
          </div>
        </div>
      </div>
    </div>
  );
}
