import {
  createInitialState,
  applyMove,
  checkWinner,
  getValidMoves,
  isGameOver,
} from '../utils/gameLogic';

describe('createInitialState', () => {
  it('cria tabuleiro vazio com 9 células nulas', () => {
    const state = createInitialState();
    expect(state.board).toHaveLength(9);
    expect(state.board.every((c) => c === null)).toBe(true);
  });

  it('define X como primeiro jogador', () => {
    expect(createInitialState().currentPlayer).toBe('X');
  });

  it('não tem vencedor no início', () => {
    expect(createInitialState().winner).toBeNull();
  });

  it('filas começam vazias', () => {
    const { queues } = createInitialState();
    expect(queues.X).toHaveLength(0);
    expect(queues.O).toHaveLength(0);
  });
});

describe('checkWinner', () => {
  it('detecta vitória em linha horizontal', () => {
    const board = ['X', 'X', 'X', null, null, null, null, null, null] as ReturnType<typeof createInitialState>['board'];
    expect(checkWinner(board, 'X')).toBe(true);
  });

  it('detecta vitória em coluna vertical', () => {
    const board = ['O', null, null, 'O', null, null, 'O', null, null] as ReturnType<typeof createInitialState>['board'];
    expect(checkWinner(board, 'O')).toBe(true);
  });

  it('detecta vitória diagonal', () => {
    const board = ['X', null, null, null, 'X', null, null, null, 'X'] as ReturnType<typeof createInitialState>['board'];
    expect(checkWinner(board, 'X')).toBe(true);
  });

  it('retorna false sem vitória', () => {
    const board = ['X', 'O', 'X', null, null, null, null, null, null] as ReturnType<typeof createInitialState>['board'];
    expect(checkWinner(board, 'X')).toBe(false);
    expect(checkWinner(board, 'O')).toBe(false);
  });
});

describe('applyMove', () => {
  it('coloca peça no tabuleiro', () => {
    const state = createInitialState();
    const next = applyMove(state, 0);
    expect(next.board[0]).toBe('X');
    expect(next.currentPlayer).toBe('O');
  });

  it('ignora movimento em célula ocupada', () => {
    let state = applyMove(createInitialState(), 0); // X em 0
    const same = applyMove(state, 0); // O tenta 0
    expect(same).toBe(state);
  });

  it('ignora movimento após vitória', () => {
    let state = createInitialState();
    state = applyMove(state, 0); // X
    state = applyMove(state, 3); // O
    state = applyMove(state, 1); // X
    state = applyMove(state, 4); // O
    state = applyMove(state, 2); // X wins [0,1,2]
    expect(state.winner).toBe('X');
    const after = applyMove(state, 8);
    expect(after.winner).toBe('X'); // não muda
    expect(after.board[8]).toBeNull();
  });

  it('detecta vitória na linha 0', () => {
    let state = createInitialState();
    state = applyMove(state, 0); // X
    state = applyMove(state, 3); // O
    state = applyMove(state, 1); // X
    state = applyMove(state, 4); // O
    state = applyMove(state, 2); // X → linha [0,1,2]
    expect(state.winner).toBe('X');
  });

  it('alterna jogadores corretamente', () => {
    let state = createInitialState();
    expect(state.currentPlayer).toBe('X');
    state = applyMove(state, 0);
    expect(state.currentPlayer).toBe('O');
    state = applyMove(state, 1);
    expect(state.currentPlayer).toBe('X');
  });
});

describe('regra infinita – remoção da 4ª peça', () => {
  it('remove a peça mais antiga ao atingir a 4ª jogada', () => {
    // X joga em 0,2,6 (3 peças), depois em 8 (4ª peça → remove 0)
    let state = createInitialState();
    state = applyMove(state, 0); // X: queue=[0]
    state = applyMove(state, 1); // O
    state = applyMove(state, 2); // X: queue=[0,2]
    state = applyMove(state, 3); // O
    state = applyMove(state, 6); // X: queue=[0,2,6]
    state = applyMove(state, 4); // O
    // Agora X tem 3 peças – fadingCell deve ser 0
    expect(state.fadingCell).toBe(0);
    state = applyMove(state, 8); // X 4ª peça → remove 0
    expect(state.board[0]).toBeNull(); // 0 foi removido
    expect(state.queues.X).toEqual([2, 6, 8]);
  });

  it('sinaliza fadingCell para o próximo jogador com 3 peças', () => {
    let state = createInitialState();
    state = applyMove(state, 0); // X
    state = applyMove(state, 1); // O
    state = applyMove(state, 2); // X
    state = applyMove(state, 3); // O
    state = applyMove(state, 6); // X – agora X tem 3 peças
    // depois da jogada de X, é vez de O; fadingCell deve ser null (O tem apenas 2 peças)
    expect(state.fadingCell).toBeNull();
    state = applyMove(state, 4); // O – agora O tem 3 peças
    // depois da jogada de O, é vez de X; X também tem 3 peças → fadingCell = 0
    expect(state.fadingCell).toBe(0);
  });
});

describe('getValidMoves', () => {
  it('retorna todos os índices vazios', () => {
    let state = createInitialState();
    state = applyMove(state, 0);
    state = applyMove(state, 1);
    const moves = getValidMoves(state);
    expect(moves).not.toContain(0);
    expect(moves).not.toContain(1);
    expect(moves).toHaveLength(7);
  });
});

describe('isGameOver', () => {
  it('retorna false quando não há vencedor', () => {
    expect(isGameOver(createInitialState())).toBe(false);
  });

  it('retorna true quando há vencedor', () => {
    let state = createInitialState();
    state = applyMove(state, 0);
    state = applyMove(state, 3);
    state = applyMove(state, 1);
    state = applyMove(state, 4);
    state = applyMove(state, 2);
    expect(isGameOver(state)).toBe(true);
  });
});
