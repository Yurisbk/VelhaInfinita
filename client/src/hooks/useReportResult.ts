import { useEffect, useRef } from 'react';
import { GameState } from '../utils/gameLogic';
import { api, GameReport } from '../services/api';

/**
 * Reports a finished local/CPU game to the server metrics once, when a winner
 * appears. `extra` carries mode-specific fields (difficulty, humanSymbol).
 */
export function useReportResult(
  state: GameState,
  moves: number[],
  startedAt: number | null,
  mode: GameReport['mode'],
  extra: Pick<GameReport, 'difficulty' | 'humanSymbol'> = {},
): void {
  // Values are read when the winner appears; keep them in a ref so the effect
  // only depends on the winner transition.
  const latest = useRef({ moves, startedAt, extra });
  latest.current = { moves, startedAt, extra };

  const { winner } = state;
  useEffect(() => {
    if (!winner) return;
    const { moves: m, startedAt: start, extra: x } = latest.current;
    api.reportGame({
      mode,
      winner,
      moves: m,
      durationSeconds: start ? Math.round((Date.now() - start) / 1000) : 0,
      ...x,
    });
  }, [winner, mode]);
}
