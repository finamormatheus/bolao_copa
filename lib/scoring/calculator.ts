export interface ScoreBreakdown {
  exact: boolean;
  winner: boolean;
  diff: boolean;
  loser: boolean;
}

export interface ScoreResult {
  basePoints: number;
  oddsBonus: number;
  totalPoints: number;
  breakdown: ScoreBreakdown;
}

type Outcome = "home" | "draw" | "away";

function getOutcome(home: number, away: number): Outcome {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

/**
 * Bônus por odds baseado na probabilidade do resultado previsto.
 * Calibrado com os exemplos: 1%→13, 6%→10, 11%→9, 26%→6, 51%→3, 80%→2, 94%→1.
 * Aplicado apenas quando o usuário acerta o vencedor/empate.
 */
export function calculateOddsBonus(probability: number): number {
  if (probability >= 0.9) return 1;
  if (probability >= 0.75) return 2;
  if (probability >= 0.45) return 3;
  if (probability >= 0.2) return 6;
  if (probability >= 0.08) return 9;
  if (probability >= 0.03) return 10;
  return 13;
}

/**
 * Calcula a pontuação de um palpite dado o resultado final e as odds travadas.
 *
 * @param predicted - placar previsto pelo usuário
 * @param actual - placar real do jogo
 * @param lockedProbs - probabilidades travadas 5min antes do jogo (home/draw/away)
 */
export function calculateScore(
  predicted: { home: number; away: number },
  actual: { home: number; away: number },
  lockedProbs?: { home: number; draw: number; away: number } | null
): ScoreResult {
  const breakdown: ScoreBreakdown = {
    exact: false,
    winner: false,
    diff: false,
    loser: false,
  };

  const isExact =
    predicted.home === actual.home && predicted.away === actual.away;

  const predictedOutcome = getOutcome(predicted.home, predicted.away);
  const actualOutcome = getOutcome(actual.home, actual.away);
  const correctOutcome = predictedOutcome === actualOutcome;

  const predictedDiff = predicted.home - predicted.away;
  const actualDiff = actual.home - actual.away;
  const correctDiff = predictedDiff === actualDiff;

  // Qual placar do time perdedor acertou?
  const predictedLoserScore =
    predicted.home < predicted.away ? predicted.home : predicted.away;
  const actualLoserScore =
    actual.home < actual.away ? actual.home : actual.away;
  const correctLoserScore =
    !isExact && !correctOutcome && predictedLoserScore === actualLoserScore;

  let basePoints = 0;

  if (isExact) {
    breakdown.exact = true;
    basePoints = 5;
  } else if (correctOutcome) {
    breakdown.winner = true;
    basePoints = 3;
  } else if (correctDiff) {
    breakdown.diff = true;
    basePoints = 2;
  } else if (correctLoserScore) {
    breakdown.loser = true;
    basePoints = 1;
  }

  let oddsBonus = 0;
  if (lockedProbs && correctOutcome) {
    const prob = lockedProbs[predictedOutcome];
    oddsBonus = calculateOddsBonus(prob);
  }

  return {
    basePoints,
    oddsBonus,
    totalPoints: basePoints + oddsBonus,
    breakdown,
  };
}
