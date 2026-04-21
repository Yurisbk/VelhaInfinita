import { useState, useCallback } from 'react';
import {
  GameState,
  createInitialState,
  applyMove,
} from '../utils/gameLogic';

export interface UseGameReturn {
  state: GameState;
  move: (index: number) => void;
  reset: () => void;
}

export function useGame(): UseGameReturn {
  const [state, setState] = useState<GameState>(createInitialState);

  const move = useCallback((index: number) => {
    setState((prev) => applyMove(prev, index));
  }, []);

  const reset = useCallback(() => {
    setState(createInitialState());
  }, []);

  return { state, move, reset };
}
