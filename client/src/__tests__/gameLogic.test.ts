import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyMove,
  checkWinner,
  getValidMoves,
  isGameOver,
} from '../utils/gameLogic';

describe('createInitialState', () => {
  it('cria tabuleiro 3x3 vazio', () => {
    const s = createInitialState();
    expect(s.board).toHaveLength(9);
    expect(s.board.every((c) => c === null)).toBe(true);
    expect(s.currentPlayer).toBe('X');
    expect(s.winner).toBeNull();
    expect(s.fadingCell).toBeNull();
    expect(s.queues.X).toHaveLength(0);
    expect(s.queues.O).toHaveLength(0);
  });
});

describe('checkWinner', () => {
  it('linha horizontal [0,1,2]', () => {
    const board = ['X', 'X', 'X', null, null, null, null, null, null] as ReturnType<typeof createInitialState>['board'];
    expect(checkWinner(board, 'X')).toBe(true);
    expect(checkWinner(board, 'O')).toBe(false);
  });

  it('coluna vertical [0,3,6]', () => {
    const board = ['O', null, null, 'O', null, null, 'O', null, null] as ReturnType<typeof createInitialState>['board'];
    expect(checkWinner(board, 'O')).toBe(true);
  });

  it('diagonal [2,4,6]', () => {
    const board = [null, null, 'X', null, 'X', null, 'X', null, null] as ReturnType<typeof createInitialState>['board'];
    expect(checkWinner(board, 'X')).toBe(true);
  });
});

describe('applyMove – movimentos básicos', () => {
  it('coloca peça e troca jogador', () => {
    const s0 = createInitialState();
    const s1 = applyMove(s0, 4);
    expect(s1.board[4]).toBe('X');
    expect(s1.currentPlayer).toBe('O');
    expect(s1.queues.X).toEqual([4]);
  });

  it('ignora célula ocupada', () => {
    const s = applyMove(createInitialState(), 0);
    const same = applyMove(s, 0);
    expect(same).toBe(s);
  });

  it('detecta vitória em 5 jogadas alternadas', () => {
    let s = createInitialState();
    [0, 3, 1, 4, 2].forEach((i) => { s = applyMove(s, i); });
    expect(s.winner).toBe('X');
    expect(isGameOver(s)).toBe(true);
  });
});

describe('regra infinita', () => {
  it('remove a peça mais antiga na 4ª jogada do mesmo jogador', () => {
    // X: 0, 2, 6 → fila de 3 → X: 8 → remove 0
    let s = createInitialState();
    s = applyMove(s, 0); // X
    s = applyMove(s, 1); // O
    s = applyMove(s, 2); // X
    s = applyMove(s, 3); // O
    s = applyMove(s, 6); // X (3 peças)
    expect(s.fadingCell).toBeNull(); // vez de O, O tem 2 peças
    s = applyMove(s, 4); // O (3 peças)
    expect(s.fadingCell).toBe(0); // vez de X, X tem 3 → a 0 vai sumir
    s = applyMove(s, 8); // X 4ª peça → remove 0
    expect(s.board[0]).toBeNull();
    expect(s.queues.X).toEqual([2, 6, 8]);
  });

  it('não remove antes de ter 4 peças', () => {
    let s = createInitialState();
    s = applyMove(s, 0); // X
    s = applyMove(s, 1); // O
    s = applyMove(s, 2); // X
    expect(s.queues.X).toHaveLength(2);
    expect(s.board[0]).toBe('X');
  });
});

describe('getValidMoves', () => {
  it('retorna 9 movimentos no início', () => {
    expect(getValidMoves(createInitialState())).toHaveLength(9);
  });

  it('exclui células ocupadas', () => {
    let s = applyMove(createInitialState(), 5);
    expect(getValidMoves(s)).not.toContain(5);
    expect(getValidMoves(s)).toHaveLength(8);
  });
});
