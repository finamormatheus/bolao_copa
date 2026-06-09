export interface ScoreBreakdown {
  exact: boolean;
  correct: boolean;
}

export interface ScoreResult {
  basePoints: number;
  exactBonus: number;
  totalPoints: number;
  breakdown: ScoreBreakdown;
}

type Outcome = "home" | "draw" | "away";

function getOutcome(home: number, away: number): Outcome {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

// Exponential fit on reference breakpoints: f(p) = a·exp(b·p) + c
// Fitted via scipy curve_fit on scripts/plot_scoring_v2.py
const EXP_A =  11.5919;
const EXP_B =  -3.8406;
const EXP_C =   1.0987;

export function probabilityToPoints(probability: number): number {
  if (probability < 0.015) return 13;
  const raw = EXP_A * Math.exp(EXP_B * probability) + EXP_C;
  return Math.round(Math.max(1, Math.min(13, raw)));
}

export function calculateScore(
  predicted: { home: number; away: number },
  actual: { home: number; away: number },
  lockedProbs?: { home: number; draw: number; away: number } | null
): ScoreResult {
  const isExact =
    predicted.home === actual.home && predicted.away === actual.away;

  const predictedOutcome = getOutcome(predicted.home, predicted.away);
  const actualOutcome = getOutcome(actual.home, actual.away);
  const correctOutcome = predictedOutcome === actualOutcome;

  const breakdown: ScoreBreakdown = {
    exact: isExact,
    correct: correctOutcome,
  };

  if (!correctOutcome) {
    return { basePoints: 0, exactBonus: 0, totalPoints: 0, breakdown };
  }

  const prob = lockedProbs ? lockedProbs[predictedOutcome] : null;
  const basePoints = prob != null ? probabilityToPoints(prob) : 1;
  const exactBonus = isExact ? 5 : 0;

  return {
    basePoints,
    exactBonus,
    totalPoints: basePoints + exactBonus,
    breakdown,
  };
}
