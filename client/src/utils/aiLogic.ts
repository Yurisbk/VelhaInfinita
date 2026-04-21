import {
  GameState,
  Player,
  applyMove,
  checkWinner,
  getValidMoves,
} from './gameLogic';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Pick a random valid move. */
function randomMove(state: GameState): number {
  const moves = getValidMoves(state);
  return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Score a terminal state from the perspective of `maximizingPlayer`.
 * +10 = maximizingPlayer wins, -10 = opponent wins, 0 = ongoing
 */
function scoreState(state: GameState, maximizingPlayer: Player): number {
  if (state.winner === maximizingPlayer) return 10;
  if (state.winner !== null) return -10;
  return 0;
}

/**
 * Minimax with alpha-beta pruning.
 * Returns the best score for `currentMinimax` player.
 */
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: Player,
): number {
  const score = scoreState(state, aiPlayer);
  if (score !== 0 || depth === 0) return score;

  const moves = getValidMoves(state);
  if (moves.length === 0) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = applyMove(state, move);
      best = Math.max(best, minimax(next, depth - 1, alpha, beta, false, aiPlayer));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const next = applyMove(state, move);
      best = Math.min(best, minimax(next, depth - 1, alpha, beta, true, aiPlayer));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

/** Find the best move using minimax at a given depth. */
function bestMove(state: GameState, depth: number): number {
  const aiPlayer = state.currentPlayer;
  const moves = getValidMoves(state);
  let bestScore = -Infinity;
  let best = moves[0];

  for (const move of moves) {
    const next = applyMove(state, move);
    const score = minimax(next, depth, -Infinity, Infinity, false, aiPlayer);
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

  // Can we win immediately?
  for (const move of moves) {
    const next = applyMove(state, move);
    if (next.winner === aiPlayer) return move;
  }

  // Can opponent win next? Block them.
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
      // Depth 6 is ample for infinite tic-tac-toe (bounded state space)
      return bestMove(state, 6);
  }
}
