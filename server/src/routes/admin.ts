import { Router, Request, Response } from 'express';
import { register } from '../utils/metrics';
import { GameRecord } from '../models/GameRecord';
import { Player } from '../models/Player';
import { getRecentAccesses } from '../middleware/ipMiddleware';

const router = Router();

/**
 * Middleware: verifica o cabeçalho "x-admin-password" contra ADMIN_PASSWORD do env.
 */
function requireAdmin(req: Request, res: Response, next: () => void): void {
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
router.post('/verify', (req: Request, res: Response): void => {
  const { password } = req.body as { password?: string };
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
router.get('/dashboard', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    // ── Métricas do Prometheus (em memória, zeram a cada restart) ─────────────
    type MetricValue = { labels: Record<string, string | number>; value: number; metricName?: string };
    type MetricJSON = { name: string; values: MetricValue[] };

    const metrics = (await register.getMetricsAsJSON()) as unknown as MetricJSON[];

    function findMetric(name: string): MetricJSON | undefined {
      return metrics.find((m) => m.name === name);
    }

    function sumMetric(name: string): number {
      return (findMetric(name)?.values ?? []).reduce((acc, v) => acc + v.value, 0);
    }

    function metricByLabel(name: string, labelKey: string): Record<string, number> {
      const result: Record<string, number> = {};
      for (const v of findMetric(name)?.values ?? []) {
        const label = String(v.labels[labelKey] ?? 'unknown');
        result[label] = (result[label] ?? 0) + v.value;
      }
      return result;
    }

    /** Histogram average per label value, from its _sum and _count series */
    function histogramAvg(name: string, labelKey: string): Record<string, { avg: number; count: number }> {
      const sums: Record<string, number> = {};
      const counts: Record<string, number> = {};
      for (const v of findMetric(name)?.values ?? []) {
        const label = String(v.labels[labelKey] ?? 'unknown');
        if (v.metricName === `${name}_sum`) sums[label] = v.value;
        if (v.metricName === `${name}_count`) counts[label] = v.value;
      }
      const result: Record<string, { avg: number; count: number }> = {};
      for (const [label, count] of Object.entries(counts)) {
        if (count > 0) result[label] = { avg: Math.round(((sums[label] ?? 0) / count) * 10) / 10, count };
      }
      return result;
    }

    const cpuByDifficulty: Record<string, { human: number; cpu: number }> = {};
    for (const v of findMetric('cpu_games_total')?.values ?? []) {
      const d = String(v.labels.difficulty);
      cpuByDifficulty[d] ??= { human: 0, cpu: 0 };
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

    // ── Estatísticas do MongoDB (persistentes) ────────────────────────────────
    type ModeCount = { _id: string; count: number; avgDuration: number; abandoned: number };
    let mongoData: {
      totalGames: number;
      gamesLast24h: number;
      byMode: ModeCount[];
      cpuByDifficulty: { _id: string; total: number; humanWins: number }[];
      gamesPerDay: { _id: string; count: number }[];
      recentGames: unknown[];
      rankedPlayers: number;
      avgElo: number | null;
      leaderboard: unknown[];
    } | null = null;

    try {
      const since24h = new Date(Date.now() - 24 * 3600 * 1000);
      const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const ranked = { $expr: { $gt: [{ $add: ['$rankedWins', '$rankedLosses'] }, 0] } };

      const [totalGames, gamesLast24h, byMode, cpuByDiff, gamesPerDay, recentGames, rankedPlayers, eloAgg, leaderboard] =
        await Promise.all([
          GameRecord.countDocuments(),
          GameRecord.countDocuments({ createdAt: { $gte: since24h } }),
          GameRecord.aggregate<ModeCount>([
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
          GameRecord.aggregate<{ _id: string; total: number; humanWins: number }>([
            { $match: { mode: 'cpu', difficulty: { $exists: true } } },
            {
              $group: {
                _id: '$difficulty',
                total: { $sum: 1 },
                humanWins: { $sum: { $cond: ['$humanWon', 1, 0] } },
              },
            },
          ]),
          GameRecord.aggregate<{ _id: string; count: number }>([
            { $match: { createdAt: { $gte: since7d } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ]),
          GameRecord.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('-_id mode winner durationSeconds moves abandoned difficulty players createdAt')
            .lean(),
          Player.countDocuments(ranked),
          Player.aggregate<{ avg: number }>([{ $match: ranked }, { $group: { _id: null, avg: { $avg: '$elo' } } }]),
          Player.find(ranked).sort({ elo: -1 }).limit(10).select('-_id name elo rankedWins rankedLosses').lean(),
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
    } catch {
      // MongoDB offline — retorna só as métricas do Prometheus
    }

    const recentAccesses = getRecentAccesses(100).map(({ ip: _ip, ...rest }) => rest);

    res.json({ prometheus: prometheusData, mongo: mongoData, recentAccesses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao coletar métricas.' });
  }
});

export default router;
