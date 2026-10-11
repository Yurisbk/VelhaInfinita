import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGame } from '../hooks/useGame';

describe('useGame', () => {
  it('registra só as jogadas válidas, em ordem', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.move(4));
    act(() => result.current.move(4)); // ocupada — ignorada
    act(() => result.current.move(0));
    expect(result.current.moves).toEqual([4, 0]);
    expect(result.current.startedAt).not.toBeNull();
  });

  it('reset limpa estado, jogadas e início', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.move(1));
    act(() => result.current.reset());
    expect(result.current.moves).toEqual([]);
    expect(result.current.startedAt).toBeNull();
    expect(result.current.state.board.every((c) => c === null)).toBe(true);
  });
});
