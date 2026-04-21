"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const metrics_1 = require("../utils/metrics");
const GameRecord_1 = require("../models/GameRecord");
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
        // ── Métricas do Prometheus ────────────────────────────────────────────────
        const rawMetrics = await metrics_1.register.getMetricsAsJSON();
        const metrics = rawMetrics;
        function findMetric(name) {
            return metrics.find((m) => m.name === name);
        }
        function sumMetric(name) {
            return (findMetric(name)?.values ?? []).reduce((acc, v) => acc + v.value, 0);
        }
        function metricByLabel(name, labelKey) {
            const result = {};
            for (const v of findMetric(name)?.values ?? []) {
                const label = v.labels[labelKey] ?? 'unknown';
                result[label] = (result[label] ?? 0) + v.value;
            }
            return result;
        }
        const prometheusData = {
            activeConnections: sumMetric('socket_connections_active'),
            activeRooms: sumMetric('game_rooms_active'),
            gamesStarted: metricByLabel('games_started_total', 'mode'),
            gamesWon: metricByLabel('games_won_total', 'mode'),
            gamesWonByWinner: metricByLabel('games_won_total', 'winner'),
            httpRequests: metricByLabel('http_requests_total', 'route'),
            totalHttpRequests: sumMetric('http_requests_total'),
        };
        // ── Estatísticas do MongoDB ───────────────────────────────────────────────
        let mongoData = { totalGames: 0, byMode: [], recentGames: [] };
        try {
            const [totalGames, byMode, recentGames] = await Promise.all([
                GameRecord_1.GameRecord.countDocuments(),
                GameRecord_1.GameRecord.aggregate([
                    { $group: { _id: '$mode', count: { $sum: 1 } } },
                ]),
                GameRecord_1.GameRecord.find().sort({ createdAt: -1 }).limit(5).select('mode winner durationSeconds createdAt'),
            ]);
            mongoData = { totalGames, byMode, recentGames };
        }
        catch {
            // MongoDB offline — retorna só as métricas do Prometheus
        }
        const recentAccesses = (0, ipMiddleware_1.getRecentAccesses)(100);
        res.json({ prometheus: prometheusData, mongo: mongoData, recentAccesses });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao coletar métricas.' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map