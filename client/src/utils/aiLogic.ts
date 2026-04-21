import {
  GameState,
  Player,
  Cell,
  applyMove,
  checkWinner,
  getValidMoves,
} from './gameLogic';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane';

const WIN_COMBOS: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** Positional weights: center > corners > edges */
const POSITION_WEIGHTS = [3, 2, 3, 2, 4, 2, 3, 2, 3];

/** Pick a random valid move. */
function randomMove(state: GameState): number {
  const moves = getValidMoves(state);
  return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Heuristic evaluation of a non-terminal board state.
 * Scores lines as: 2-in-a-row open = +/- lineWeight, positional bonus.
 * aggressiveness controls how much threat lines are weighted.
 */
function evaluateBoard(board: Cell[], aiPlayer: Player, aggressiveness: number): number {
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  let score = 0;

  for (const [a, b, c] of WIN_COMBOS) {
    const cells = [board[a], board[b], board[c]];
    const aiCount = cells.filter((v) => v === aiPlayer).length;
    const oppCount = cells.filter((v) => v === opponent).length;

    if (aiCount > 0 && oppCount === 0) {
      score += aiCount === 2 ? aggressiveness * 2 : aggressiveness;
    } else if (oppCount > 0 && aiCount === 0) {
      score -= oppCount === 2 ? aggressiveness * 2 : aggressiveness;
    }
  }

  for (let i = 0; i < 9; i++) {
    if (board[i] === aiPlayer) score += POSITION_WEIGHTS[i];
    else if (board[i] === opponent) score -= POSITION_WEIGHTS[i];
  }

  return score;
}

/**
 * Terminal score: adjusted by depth to prefer faster wins.
 * aggressiveness amplifies terminal scores for insane mode.
 */
function scoreState(
  state: GameState,
  maximizingPlayer: Player,
  depth: number,
  aggressiveness: number,
): number {
  if (state.winner === maximizingPlayer) return (100 + depth) * aggressiveness;
  if (state.winner !== null) return -(100 + depth) * aggressiveness;
  return 0;
}

/**
 * Minimax with alpha-beta pruning and heuristic evaluation at leaf nodes.
 */
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  aggressiveness: number,
): number {
  const terminal = scoreState(state, aiPlayer, depth, aggressiveness);
  if (terminal !== 0) return terminal;
  if (depth === 0) return evaluateBoard(state.board, aiPlayer, aggressiveness);

  const moves = getValidMoves(state);
  if (moves.length === 0) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = applyMove(state, move);
      best = Math.max(
        best,
        minimax(next, depth - 1, alpha, beta, false, aiPlayer, aggressiveness),
      );
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const next = applyMove(state, move);
      best = Math.min(
        best,
        minimax(next, depth - 1, alpha, beta, true, aiPlayer, aggressiveness),
      );
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

/** Find the best move using minimax at a given depth. */
function bestMove(state: GameState, depth: number, aggressiveness: number): number {
  const aiPlayer = state.currentPlayer;
  const moves = getValidMoves(state);

  // Sort moves: center and corners first to improve pruning
  const sorted = [...moves].sort((a, b) => POSITION_WEIGHTS[b] - POSITION_WEIGHTS[a]);

  let bestScore = -Infinity;
  let best = sorted[0];

  for (const move of sorted) {
    const next = applyMove(state, move);
    const score = minimax(next, depth, -Infinity, Infinity, false, aiPlayer, aggressiveness);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}

/**
 * Medium AI:
 * – Win if possible (1-ply look-ahead)
 * – Block opponent win if possible
 * – Otherwise random
 */
function mediumMove(state: GameState): number {
  const aiPlayer = state.currentPlayer;
  const opponent: Player = aiPlayer === 'X' ? 'O' : 'X';
  const moves = getValidMoves(state);

  for (const move of moves) {
    const next = applyMove(state, move);
    if (next.winner === aiPlayer) return move;
  }

  for (const move of moves) {
    const testBoard = [...state.board];
    testBoard[move] = opponent;
    if (checkWinner(testBoard, opponent)) return move;
  }

  return randomMove(state);
}

/** Choose a move based on difficulty level. */
export function chooseMove(state: GameState, difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return randomMove(state);

    case 'medium':
      return mediumMove(state);

    case 'hard':
      return bestMove(state, 9, 1);

    case 'insane':
      return bestMove(state, 12, 2);
  }
}
