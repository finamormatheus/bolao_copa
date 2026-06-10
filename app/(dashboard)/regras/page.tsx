import type { ReactNode } from "react";
import Link from "next/link";
import { probabilityToPoints } from "@/lib/scoring/calculator";
import SimuladorPontos from "./SimuladorPontos";

const PTS_MIN = 1;
const PTS_MAX = 13;
const EXACT_BONUS = 5;
const CHAMPION_BONUS = 20;
const LOCK_MINUTES = 5;
const SCALE_PROBS = [0.9, 0.6, 0.4, 0.25, 0.12, 0.04, 0.01];

const EX_HOME_PROB = 0.61;

const DISPLAY = '"FWC2026", system-ui, sans-serif';
const UI = 'system-ui, sans-serif';

/* ---------- Flag chip with FWC2026 diagonal corner ---------- */
function Flag({ slug, size = 30 }: { slug: string; size?: number }) {
  const h = Math.round(size * 0.68);
  const big = Math.max(5, Math.round(size * 0.3));
  const sm = Math.max(2, Math.round(size * 0.085));
  return (
    <span style={{
      width: size, height: h,
      borderRadius: `${big}px ${sm}px ${big}px ${sm}px`,
      overflow: "hidden", flexShrink: 0, display: "inline-block",
      border: "1.5px solid rgba(247,247,248,0.92)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
      background: "var(--bolao-surface-3)",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/flags/regular/${slug}.png`}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </span>
  );
}

/* ---------- Lime numbered badge ---------- */
function StepNum({ n }: { n: number }) {
  return (
    <span style={{
      width: 38, height: 38, borderRadius: 12, flexShrink: 0,
      background: "var(--bolao-lime)", color: "var(--bolao-ink-dark)",
      fontSize: 19, fontWeight: 800, fontFamily: DISPLAY,
      fontVariantNumeric: "tabular-nums",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>{n}</span>
  );
}

/* ---------- Reward summary card ---------- */
function RewardCard({ value, unit, label, sub, tone = "lime" }: {
  value: string; unit: string; label: string; sub: string; tone?: "lime" | "gold";
}) {
  const color = tone === "gold" ? "var(--bolao-gold)" : "var(--bolao-lime)";
  const soft  = tone === "gold" ? "rgba(232,163,14,0.14)" : "var(--bolao-lime-soft)";
  const ring  = tone === "gold" ? "rgba(232,163,14,0.30)" : "rgba(173,235,3,0.28)";
  return (
    <div style={{
      flex: "1 1 160px", background: "var(--bolao-surface)",
      border: "1px solid var(--bolao-hairline)", borderRadius: 18,
      padding: "18px 16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(120px 80px at 100% 0%, ${soft}, transparent 70%)`,
      }} />
      <div style={{ position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "baseline", gap: 4, marginBottom: 12,
          background: soft, border: `1px solid ${ring}`, color,
          borderRadius: 999, padding: "5px 12px 3px",
        }}>
          <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>{value}</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: DISPLAY }}>{unit}</span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "0.01em", marginBottom: 4, textTransform: "uppercase", fontFamily: DISPLAY }}>{label}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--bolao-ink-dim)", fontFamily: UI }}>{sub}</div>
      </div>
    </div>
  );
}

/* ---------- Numbered rule block ---------- */
function RuleBlock({ n, title, lead, children }: {
  n: number; title: string; lead?: string; children?: ReactNode;
}) {
  return (
    <section style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <StepNum n={n} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: "5px 0 6px", fontSize: 19, fontWeight: 800, letterSpacing: "0.005em", textTransform: "uppercase", fontFamily: DISPLAY }}>{title}</h3>
        {lead && (
          <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.6, color: "var(--bolao-ink-dim)", fontFamily: UI, maxWidth: "60ch" }}>{lead}</p>
        )}
        {children}
      </div>
    </section>
  );
}

/* ---------- Probability → points bar chart ---------- */
function PointsScaleChart({ scale }: { scale: Array<{ prob: number; pts: number }> }) {
  return (
    <div style={{ background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)", borderRadius: 18, padding: "20px 18px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "var(--bolao-ink-faint)", fontFamily: UI, textTransform: "uppercase" }}>Favorito · vale menos</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "var(--bolao-lime)", fontFamily: UI, textTransform: "uppercase" }}>Zebra · vale mais</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 132 }}>
        {scale.map((s, i) => {
          const t = (s.pts - 1) / (PTS_MAX - 1);
          const isLime = t > 0.45;
          const hasGlow = t > 0.7;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, height: "100%" }}>
              <span style={{ fontSize: 14, fontWeight: 800, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums", color: isLime ? "var(--bolao-lime)" : "var(--bolao-ink-dim)" }}>+{s.pts}</span>
              <div style={{
                width: "100%", maxWidth: 30,
                height: `${Math.round(18 + t * 78)}%`,
                background: isLime ? "var(--bolao-lime)" : "var(--bolao-surface-2)",
                borderRadius: "6px 6px 3px 3px",
                boxShadow: hasGlow ? "0 0 16px -4px var(--bolao-lime)" : "none",
              }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--bolao-ink-faint)", fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>
                {Math.round(s.prob * 100)}%
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: 9, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "var(--bolao-ink-faint)", fontFamily: UI, textTransform: "uppercase" }}>
        Probabilidade do resultado que você acertou
      </div>
    </div>
  );
}

/* ---------- Big points pill for worked example ---------- */
function BigPts({ value, label, tone = "ink" }: { value: string; label: string; tone?: "lime" | "green" | "ink" }) {
  const color = tone === "lime" ? "var(--bolao-lime)" : tone === "green" ? "var(--bolao-green-win)" : "var(--bolao-ink)";
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "center" }}>
        <span style={{ fontSize: 30, fontWeight: 800, color, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--bolao-ink-faint)", fontFamily: DISPLAY, textTransform: "uppercase" }}>pts</span>
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--bolao-ink-faint)", fontFamily: UI, marginTop: 2, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

/* ---------- Worked example card (Brasil 2–1 Marrocos) ---------- */
function WorkedExample({ exBase, exTotal }: { exBase: number; exTotal: number }) {
  return (
    <div style={{ background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)", borderRadius: 18, overflow: "hidden" }}>
      <div style={{ background: "var(--bolao-surface-2)", padding: "9px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em", color: "var(--bolao-ink-dim)", textTransform: "uppercase", fontFamily: DISPLAY }}>Exemplo</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", color: "var(--bolao-green-win)", textTransform: "uppercase", fontFamily: DISPLAY }}>🎯 Cravou!</span>
      </div>

      <div style={{ padding: "16px 16px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Flag slug="brazil" />
            <span style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", fontFamily: DISPLAY }}>Brasil</span>
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums", color: "var(--bolao-ink)" }}>
            2<span style={{ color: "var(--bolao-ink-faint)", padding: "0 6px" }}>–</span>1
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", fontFamily: DISPLAY }}>Marrocos</span>
            <Flag slug="morocco" />
          </span>
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--bolao-ink-dim)", fontFamily: UI }}>
          Você palpitou{" "}
          <span style={{ color: "var(--bolao-ink)", fontWeight: 800, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>2–1</span>
          {" "}· resultado real{" "}
          <span style={{ color: "var(--bolao-ink)", fontWeight: 800, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>2–1</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap", padding: "12px 16px 18px", marginTop: 6 }}>
        <BigPts value={`+${exBase}`} label={`Resultado · ${Math.round(EX_HOME_PROB * 100)}%`} />
        <span style={{ fontSize: 22, color: "var(--bolao-ink-faint)", fontWeight: 700, padding: "0 6px", fontFamily: DISPLAY }}>+</span>
        <BigPts value={`+${EXACT_BONUS}`} label="Cravada" tone="green" />
        <span style={{ fontSize: 22, color: "var(--bolao-ink-faint)", fontWeight: 700, padding: "0 6px", fontFamily: DISPLAY }}>=</span>
        <BigPts value={`+${exTotal}`} label="No jogo" tone="lime" />
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function RegrasPage() {
  const scale = SCALE_PROBS.map((p) => ({ prob: p, pts: probabilityToPoints(p) }));
  const exBase = probabilityToPoints(EX_HOME_PROB);
  const exTotal = exBase + EXACT_BONUS;

  const divider = <div style={{ height: 1, background: "var(--bolao-hairline)", margin: "30px 0" }} />;

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 32, fontWeight: 800, letterSpacing: "-0.01em", textTransform: "uppercase", fontFamily: DISPLAY }}>
          Regras
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--bolao-ink-dim)", fontFamily: UI }}>
          Tudo o que conta pontos — e como cada palpite vira posição no ranking.
        </p>
      </div>

      {/* Reward summary */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
        <RewardCard
          value={`${PTS_MIN}–${PTS_MAX}`} unit="pts"
          label="Acertou o resultado"
          sub="Quem ganha ou empate. Vale conforme a probabilidade."
        />
        <RewardCard
          value={`+${EXACT_BONUS}`} unit="pts"
          label="Cravou o placar"
          sub="Bônus por acertar o placar exato da partida."
        />
        <RewardCard
          value={`+${CHAMPION_BONUS}`} unit="pts"
          label="Acertou o campeão" tone="gold"
          sub="No fim do torneio, se você levantou a taça certa."
        />
      </div>

      {divider}

      {/* Rule blocks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <RuleBlock n={1} title="Faça seu palpite"
          lead="Antes de cada jogo, você crava o placar dos dois times. Pode editar quantas vezes quiser — o palpite só conta quando travado." />

        <RuleBlock n={2} title="Pontue pelo resultado"
          lead="Acertar o resultado (vitória de um lado ou empate) já garante pontos. O valor depende da probabilidade: quanto mais improvável o resultado que você acertou, mais ele vale. Acertar o favorito rende pouco; cravar a zebra rende muito.">
          <PointsScaleChart scale={scale} />
          <SimuladorPontos />
        </RuleBlock>

        <RuleBlock n={3} title="Crave o placar exato"
          lead={`Se além do resultado você acertar o placar na mosca, ganha +${EXACT_BONUS} pontos de bônus — somados aos pontos do resultado. Isso é uma "cravada".`}>
          <WorkedExample exBase={exBase} exTotal={exTotal} />
        </RuleBlock>

        <RuleBlock n={4} title="Resultado errado, zero"
          lead="Se você erra quem venceu (ou marca empate e o jogo teve vencedor), o palpite vale 0 ponto — mesmo que um dos placares coincida. É tudo ou nada no resultado." />

        <RuleBlock n={5} title="Aposte no campeão"
          lead={`Logo no começo da Copa você escolhe quem leva o título. Acertou? +${CHAMPION_BONUS} pontos no encerramento. A escolha trava junto com a bola rolando no primeiro jogo.`} />

        <RuleBlock n={6} title="O relógio manda"
          lead={`Cada palpite trava ${LOCK_MINUTES} minutos antes do apito inicial. Depois disso o jogo aparece bloqueado e os palpites do grupo são revelados — ninguém edita mais nada.`} />
      </div>

      {divider}

      {/* Two phases */}
      <section>
        <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800, textTransform: "uppercase", fontFamily: DISPLAY }}>Em duas fases</h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "var(--bolao-ink-dim)", fontFamily: UI, maxWidth: "62ch" }}>
          O bolão abre em etapas, acompanhando o chaveamento da Copa. Você não palpita tudo de uma vez.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {([
            ["1ª", "Fase de grupos", "No começo, só os jogos da fase de grupos ficam abertos para palpite. É aqui que todo mundo entra em campo ao mesmo tempo.", "var(--bolao-lime)"],
            ["2ª", "Mata-mata", "Conforme os confrontos do mata-mata vão sendo definidos, cada nova rodada (oitavas, quartas, semis e final) abre para palpite. Você aposta a cada fase, quando os times já são conhecidos.", "var(--bolao-gold)"],
          ] as const).map(([tag, heading, desc, color]) => (
            <div key={heading} style={{ background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)", borderRadius: 16, padding: "18px 17px" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: color, color: "var(--bolao-ink-dark)", borderRadius: 9,
                padding: "4px 10px", fontSize: 13, fontWeight: 800, marginBottom: 11,
                textTransform: "uppercase", fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums",
              }}>{tag} fase</span>
              <div style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 5, textTransform: "uppercase", fontFamily: DISPLAY }}>{heading}</div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--bolao-ink-dim)", fontFamily: UI }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {divider}

      {/* Ranking rollup */}
      <section>
        <h2 style={{ margin: "0 0 12px", fontSize: 21, fontWeight: 800, textTransform: "uppercase", fontFamily: DISPLAY }}>No ranking</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          {([
            ["Soma de tudo", "Pontos de cada jogo + bônus de cravada + campeão. Maior soma lidera."],
            ["Desempate", "Empatou em pontos? Quem tem mais cravadas fica na frente."],
            ["Variação", "As setas ▲▼ mostram quantas posições você subiu ou caiu desde o último dia de jogo."],
          ] as const).map(([heading, desc]) => (
            <div key={heading} style={{ background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)", borderRadius: 14, padding: "14px 15px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--bolao-lime)", marginBottom: 5, letterSpacing: "0.01em", textTransform: "uppercase", fontFamily: DISPLAY }}>{heading}</div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--bolao-ink-dim)", fontFamily: UI }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {divider}

      {/* Where probabilities come from */}
      <section>
        <h2 style={{ margin: "0 0 12px", fontSize: 21, fontWeight: 800, textTransform: "uppercase", fontFamily: DISPLAY }}>De onde vêm as probabilidades</h2>
        <div style={{ background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)", borderRadius: 18, padding: "20px 19px" }}>
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.65, color: "var(--bolao-ink-dim)", fontFamily: UI, maxWidth: "64ch" }}>
            As probabilidades usadas no cálculo dos pontos vêm de odds de mercado, fornecidas pela{" "}
            <span style={{ color: "var(--bolao-ink)", fontWeight: 700, fontFamily: DISPLAY }}>The Odds API</span> — uma fonte que
            agrega as cotações de dezenas de casas de apostas esportivas ao redor do mundo.
          </p>

          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.65, color: "var(--bolao-ink-dim)", fontFamily: UI, maxWidth: "64ch" }}>
            As probabilidades são atualizadas frequentemente e servem para você ter uma referência ao fazer seu palpite.
          </p>

          <div style={{ display: "flex", gap: 12, background: "rgba(247,247,248,0.04)", border: "1px solid var(--bolao-hairline)", borderRadius: 12, padding: "14px 15px" }}>
            <span style={{ width: 4, borderRadius: 99, background: "var(--bolao-lime)", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--bolao-ink)", fontFamily: UI, maxWidth: "62ch" }}>
              O que vale para o cálculo dos pontos é sempre a{" "}
              <span style={{ fontWeight: 700, fontFamily: DISPLAY }}>probabilidade travada no momento em que o jogo começa</span>.
              O momento em que você fez o palpite não influencia sua pontuação — todos que apostaram no mesmo resultado recebem os mesmos pontos.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div style={{ marginTop: 34, display: "flex", justifyContent: "center" }}>
        <Link href="/palpites" style={{
          textDecoration: "none", background: "var(--bolao-lime)", color: "var(--bolao-ink-dark)",
          borderRadius: 12, padding: "13px 26px", fontSize: 14, fontWeight: 800,
          letterSpacing: "0.03em", textTransform: "uppercase", fontFamily: DISPLAY,
        }}>
          Fazer meus palpites →
        </Link>
      </div>
    </div>
  );
}
