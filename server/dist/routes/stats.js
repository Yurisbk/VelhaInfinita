"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GameRecord_1 = require("../models/GameRecord");
const metrics_1 = require("../utils/metrics");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const [totalGames, byMode, byWinner] = await Promise.all([
            GameRecord_1.GameRecord.countDocuments(),
            GameRecord_1.GameRecord.aggregate([
                { $group: { _id: '$mode', count: { $sum: 1 } } },
            ]),
            GameRecord_1.GameRecord.aggregate([
                { $group: { _id: { mode: '$mode', winner: '$winner' }, count: { $sum: 1 } } },
            ]),
        ]);
        res.json({ totalGames, byMode, byWinner });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar estatísticas.' });
    }
});
/**
 * POST /api/stats/game
 * Local and CPU games run entirely in the browser; the client reports the
 * result here so they show up in the metrics. Online modes are recorded by
 * the socket server and are rejected here.
 */
router.post('/game', (req, res) => {
    const { mode, winner, moves, durationSeconds, difficulty, humanSymbol } = req.body;
    const validMoves = Array.isArray(moves) &&
        moves.length <= 500 &&
        moves.every((m) => Number.isInteger(m) && m >= 0 && m <= 8);
    if ((mode !== 'local' && mode !== 'cpu') ||
        (winner !== 'X' && winner !== 'O') ||
        !validMoves ||
        typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) ||
        durationSeconds < 0 || durationSeconds > 24 * 3600 ||
        (mode === 'cpu' && (!GameRecord_1.DIFFICULTIES.includes(difficulty) || (humanSymbol !== 'X' && humanSymbol !== 'O')))) {
        res.status(400).json({ message: 'Partida inválida.' });
        return;
    }
    const moveList = moves;
    const duration = Math.round(durationSeconds);
    const humanWon = mode === 'cpu' ? winner === humanSymbol : undefined;
    metrics_1.gamesStartedTotal.inc({ mode });
    metrics_1.gamesWonTotal.inc({ mode, winner });
    metrics_1.gameDurationSeconds.observe({ mode }, duration);
    metrics_1.gameMoves.observe({ mode }, moveList.length);
    if (mode === 'cpu') {
        metrics_1.cpuGamesTotal.inc({ difficulty: difficulty, result: humanWon ? 'human' : 'cpu' });
    }
    GameRecord_1.GameRecord.create({
        mode,
        winner,
        moves: moveList,
        durationSeconds: duration,
        difficulty: mode === 'cpu' ? difficulty : undefined,
        humanWon,
    }).catch(console.error);
    res.status(201).json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=stats.js.map