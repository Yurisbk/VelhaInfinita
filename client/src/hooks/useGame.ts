import { useState, useCallback } from 'react';
import {
  GameState,
  createInitialState,
  applyMove,
} from '../utils/gameLogic';

export interface UseGameReturn {
  state: GameState;
  /** Indices played so far in this game, in order */
  moves: number[];
  /** Timestamp of the first move (null before it) */
  startedAt: number | null;
  move: (index: number) => void;
  reset: () => void;
}

interface Game {
  state: GameState;
  moves: number[];
  startedAt: number | null;
}

const newGame = (): Game => ({ state: createInitialState(), moves: [], startedAt: null });

export function useGame(): UseGameReturn {
  const [game, setGame] = useState<Game>(newGame);

  const move = useCallback((index: number) => {
    setGame((prev) => {
      const next = applyMove(prev.state, index);
      if (next === prev.state) return prev;
      return {
        state: next,
        moves: [...prev.moves, index],
        startedAt: prev.startedAt ?? Date.now(),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setGame(newGame());
  }, []);

  return { ...game, move, reset };
}
