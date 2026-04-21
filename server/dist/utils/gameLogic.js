"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWinner = checkWinner;
exports.getValidMoves = getValidMoves;
exports.createInitialState = createInitialState;
exports.applyMove = applyMove;
exports.isGameOver = isGameOver;
const WIN_COMBOS = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];
function checkWinner(board, player) {
    return WIN_COMBOS.some(([a, b, c]) => board[a] === player && board[b] === player && board[c] === player);
}
function getValidMoves(state) {
    return state.board
        .map((cell, idx) => (cell === null ? idx : -1))
        .filter((idx) => idx !== -1);
}
function createInitialState() {
    return {
        board: Array(9).fill(null),
        queues: { X: [], O: [] },
        currentPlayer: 'X',
        winner: null,
        fadingCell: null,
    };
}
/**
 * Apply a move to the current game state and return the new state.
 * Infinite rule: if a player already has 3 pieces and places a 4th,
 * the oldest (fading) piece is removed FIRST, then win is checked.
 * The fading piece cannot be part of a winning combination.
 */
function applyMove(state, index) {
    if (state.winner !== null)
        return state;
    if (state.board[index] !== null)
        return state;
    const { currentPlayer } = state;
    const newBoard = [...state.board];
    const newQueues = {
        X: [...state.queues.X],
        O: [...state.queues.O],
    };
    newBoard[index] = currentPlayer;
    newQueues[currentPlayer].push(index);
    if (newQueues[currentPlayer].length > 3) {
        const removed = newQueues[currentPlayer].shift();
        newBoard[removed] = null;
    }
    if (checkWinner(newBoard, currentPlayer)) {
        return {
            board: newBoard,
            queues: newQueues,
            currentPlayer,
            winner: currentPlayer,
            fadingCell: null,
        };
    }
    const nextPlayer = currentPlayer === 'X' ? 'O' : 'X';
    const fadingCell = newQueues[nextPlayer].length === 3 ? newQueues[nextPlayer][0] : null;
    return {
        board: newBoard,
        queues: newQueues,
        currentPlayer: nextPlayer,
        winner: null,
        fadingCell,
    };
}
function isGameOver(state) {
    return state.winner !== null;
}
//# sourceMappingURL=gameLogic.js.map