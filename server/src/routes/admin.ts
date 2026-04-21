import { Router, Request, Response } from 'express';
import { register } from '../utils/metrics';
import { GameRecord } from '../models/GameRecord';
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
    // ── Métricas do Prometheus ────────────────────────────────────────────────
    const rawMetrics = await register.getMetricsAsJSON();

    type MetricValue = { labels: Record<string, string>; value: number };
    type MetricJSON = { name: string; values: MetricValue[] };

    const metrics = rawMetrics as unknown as MetricJSON[];

    function findMetric(name: string): MetricJSON | undefined {
      return metrics.find((m) => m.name === name);
    }

    function sumMetric(name: string): number {
      return (findMetric(name)?.values ?? []).reduce((acc, v) => acc + v.value, 0);
    }

    function metricByLabel(name: string, labelKey: string): Record<string, number> {
      const result: Record<string, number> = {};
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
    let mongoData: {
      totalGames: number;
      byMode: { _id: string; count: number }[];
      recentGames: unknown[];
    } = { totalGames: 0, byMode: [], recentGames: [] };

    try {
      const [totalGames, byMode, recentGames] = await Promise.all([
        GameRecord.countDocuments(),
        GameRecord.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$mode', count: { $sum: 1 } } },
        ]),
        GameRecord.find().sort({ createdAt: -1 }).limit(5).select('mode winner durationSeconds createdAt'),
      ]);
      mongoData = { totalGames, byMode, recentGames };
    } catch {
      // MongoDB offline — retorna só as métricas do Prometheus
    }

    const recentAccesses = getRecentAccesses(100);

    res.json({ prometheus: prometheusData, mongo: mongoData, recentAccesses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao coletar métricas.' });
  }
});

export default router;
