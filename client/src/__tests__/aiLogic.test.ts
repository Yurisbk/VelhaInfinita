import { describe, it, expect } from 'vitest';
import { chooseMove } from '../utils/aiLogic';
import { createInitialState, applyMove, getValidMoves } from '../utils/gameLogic';

describe('AI – fácil (random)', () => {
  it('retorna um movimento válido', () => {
    const state = createInitialState();
    const move = chooseMove(state, 'easy');
    expect(getValidMoves(state)).toContain(move);
  });

  it('funciona mesmo com poucas células disponíveis', () => {
    // preenche 8 células manualmente através de jogadas
    let s = createInitialState();
    // jogadas que não criam vitória imediata: X em par, O em ímpar
    const indices = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = 0; i < indices.length; i++) {
      if (!s.winner) s = applyMove(s, indices[i]);
    }
    if (!s.winner) {
      const move = chooseMove(s, 'easy');
      expect(getValidMoves(s)).toContain(move);
    }
  });
});

describe('AI – médio', () => {
  it('vence imediatamente quando possível', () => {
    // X tem [0,1] e pode vencer em 2
    let state = createInitialState();
    state = applyMove(state, 0); // X
    state = applyMove(state, 3); // O
    state = applyMove(state, 1); // X  → X pode ganhar em 2
    // Troca para ser vez de O; forcemos ser vez de X via hack: criaremos um estado artificial
    // Mais simples: testar o caso onde a CPU (O) pode vencer
    // O tem [3,4] → pode ganhar em 5
    state = applyMove(state, 4); // O

    // Agora é vez de X – mas o CPU pode jogar como O (simular)
    // Melhor testar como: criamos estado em que a CPU (currentPlayer) pode vencer
    const cpuState = {
      ...state,
      currentPlayer: 'O' as const,
      // artificialmente dar ao O mais uma peça para quase-vitória
    };
    // O tem [3,4] → joga 5 para vencer
    const move = chooseMove({ ...cpuState }, 'medium');
    expect(move).toBe(5);
  });

  it('bloqueia vitória iminente do oponente', () => {
    // X tem [0,1] → O deve bloquear em 2
    let state = createInitialState();
    state = applyMove(state, 0); // X
    state = applyMove(state, 6); // O
    state = applyMove(state, 1); // X – X pode vencer em 2
    // agora é vez de O
    const move = chooseMove(state, 'medium');
    expect(move).toBe(2);
  });
});

describe('AI – difícil (minimax)', () => {
  it('retorna um movimento válido', () => {
    const state = createInitialState();
    const move = chooseMove(state, 'hard');
    expect(getValidMoves(state)).toContain(move);
  });

  it('vence imediatamente quando possível', () => {
    // X (CPU) tem [0,1] → deve jogar 2
    let state = createInitialState();
    state = applyMove(state, 0); // X
    state = applyMove(state, 3); // O
    state = applyMove(state, 1); // X pode vencer em 2
    state = applyMove(state, 4); // O
    // Criamos estado onde X é a CPU e pode vencer em 2
    const cpuState = { ...state, currentPlayer: 'X' as const };
    const move = chooseMove(cpuState, 'hard');
    expect(move).toBe(2);
  });
});
