"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const metrics_1 = require("../utils/metrics");
const GameRecord_1 = require("../models/GameRecord");
const Player_1 = require("../models/Player");
const ipMiddleware_1 = require("../middleware/ipMiddleware");
const router = (0, express_1.Router)();
/**
 * Middleware: verifica o cabeçalho "x-admin-password" contra ADMIN_PASSWORD do env.
 */
function requireAdmin(req, res, next) {
    const provided = req.headers['x-admin-password'];
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || provided !== expected) {
        res.status(401).json({ message: 'Senha de admin incorreta.' });
        return;
    }
    next();
}
/**
 * POST /api/admin/verify — valida a senha e retorna ok
 */
router.post('/verify', (req, res) => {
    const { password } = req.body;
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || password !== expected) {
        res.status(401).json({ ok: false });
        return;
    }
    res.json({ ok: true });
});
/**
 * GET /api/admin/dashboard — retorna métricas consolidadas (requer admin)
 */
router.get('/dashboard', requireAdmin, async (_req, res) => {
    try {
        const metrics = (await metrics_1.register.getMetricsAsJSON());
        function findMetric(name) {
            return metrics.find((m) => m.name === name);
        }
        function sumMetric(name) {
            return (findMetric(name)?.values ?? []).reduce((acc, v) => acc + v.value, 0);
        }
        function metricByLabel(name, labelKey) {
            const result = {};
            for (const v of findMetric(name)?.values ?? []) {
                const label = String(v.labels[labelKey] ?? 'unknown');
                result[label] = (result[label] ?? 0) + v.value;
            }
            return result;
        }
        /** Histogram average per label value, from its _sum and _count series */
        function histogramAvg(name, labelKey) {
            const sums = {};
            const counts = {};
            for (const v of findMetric(name)?.values ?? []) {
                const label = String(v.labels[labelKey] ?? 'unknown');
                if (v.metricName === `${name}_sum`)
                    sums[label] = v.value;
                if (v.metricName === `${name}_count`)
                    counts[label] = v.value;
            }
            const result = {};
            for (const [label, count] of Object.entries(counts)) {
                if (count > 0)
                    result[label] = { avg: Math.round(((sums[label] ?? 0) / count) * 10) / 10, count };
            }
            return result;
        }
        const cpuByDifficulty = {};
        for (const v of findMetric('cpu_games_total')?.values ?? []) {
            const d = String(v.labels.difficulty);
            cpuByDifficulty[d] ?? (cpuByDifficulty[d] = { human: 0, cpu: 0 });
            cpuByDifficulty[d][v.labels.result === 'human' ? 'human' : 'cpu'] += v.value;
        }
        const httpErrors = (findMetric('http_requests_total')?.values ?? [])
            .filter((v) => Number(v.labels.status_code) >= 500)
            .reduce((acc, v) => acc + v.value, 0);
        const prometheusData = {
            uptimeSeconds: Math.round(process.uptime()),
            activeConnections: sumMetric('socket_connections_active'),
            activeRooms: sumMetric('game_rooms_active'),
            queueSizes: metricByLabel('matchmaking_queue_size', 'queue'),
            gamesStarted: metricByLabel('games_started_total', 'mode'),
            gamesWon: metricByLabel('games_won_total', 'mode'),
            gamesWonByWinner: metricByLabel('games_won_total', 'winner'),
            gamesAbandoned: metricByLabel('games_abandoned_total', 'mode'),
            rematches: metricByLabel('rematches_total', 'mode'),
            avgDuration: histogramAvg('game_duration_seconds', 'mode'),
            avgMoves: histogramAvg('game_moves', 'mode'),
            matchmakingWait: histogramAvg('matchmaking_wait_seconds', 'queue'),
            matchmakingTimeouts: metricByLabel('matchmaking_timeouts_total', 'queue'),
            cpuByDifficulty,
            eloUpdates: metricByLabel('elo_updates_total', 'status'),
            httpRequests: metricByLabel('http_requests_total', 'route'),
            totalHttpRequests: sumMetric('http_requests_total'),
            httpErrors,
        };
        let mongoData = null;
        try {
            const since24h = new Date(Date.now() - 24 * 3600 * 1000);
            const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
            const ranked = { $expr: { $gt: [{ $add: ['$rankedWins', '$rankedLosses'] }, 0] } };
            const [totalGames, gamesLast24h, byMode, cpuByDiff, gamesPerDay, recentGames, rankedPlayers, eloAgg, leaderboard] = await Promise.all([
                GameRecord_1.GameRecord.countDocuments(),
                GameRecord_1.GameRecord.countDocuments({ createdAt: { $gte: since24h } }),
                GameRecord_1.GameRecord.aggregate([
                    {
                        $group: {
                            _id: '$mode',
                            count: { $sum: 1 },
                            avgDuration: { $avg: '$durationSeconds' },
                            abandoned: { $sum: { $cond: ['$abandoned', 1, 0] } },
                        },
                    },
                    { $sort: { count: -1 } },
                ]),
                GameRecord_1.GameRecord.aggregate([
                    { $match: { mode: 'cpu', difficulty: { $exists: true } } },
                    {
                        $group: {
                            _id: '$difficulty',
                            total: { $sum: 1 },
                            humanWins: { $sum: { $cond: ['$humanWon', 1, 0] } },
                        },
                    },
                ]),
                GameRecord_1.GameRecord.aggregate([
                    { $match: { createdAt: { $gte: since7d } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                    { $sort: { _id: 1 } },
                ]),
                GameRecord_1.GameRecord.find()
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select('-_id mode winner durationSeconds moves abandoned difficulty players createdAt')
                    .lean(),
                Player_1.Player.countDocuments(ranked),
                Player_1.Player.aggregate([{ $match: ranked }, { $group: { _id: null, avg: { $avg: '$elo' } } }]),
                Player_1.Player.find(ranked).sort({ elo: -1 }).limit(10).select('-_id name elo rankedWins rankedLosses').lean(),
            ]);
            mongoData = {
                totalGames,
                gamesLast24h,
                byMode: byMode.map((b) => ({ ...b, avgDuration: Math.round(b.avgDuration ?? 0) })),
                cpuByDifficulty: cpuByDiff,
                gamesPerDay,
                recentGames: recentGames.map((g) => ({ ...g, moves: undefined, moveCount: g.moves?.length ?? 0 })),
                rankedPlayers,
                avgElo: eloAgg[0] ? Math.round(eloAgg[0].avg) : null,
                leaderboard,
            };
        }
        catch {
            // MongoDB offline — retorna só as métricas do Prometheus
        }
        const recentAccesses = (0, ipMiddleware_1.getRecentAccesses)(100).map(({ ip: _ip, ...rest }) => rest);
        res.json({ prometheus: prometheusData, mongo: mongoData, recentAccesses });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao coletar métricas.' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map