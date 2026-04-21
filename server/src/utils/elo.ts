const K = 32;

export function calcElo(
  winnerElo: number,
  loserElo: number,
): { winner: number; loser: number } {
  const expected = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  return {
    winner: Math.round(winnerElo + K * (1 - expected)),
    loser:  Math.round(loserElo  + K * (0 - (1 - expected))),
  };
}
