import { Router, Request, Response } from 'express';
import { Player } from '../models/Player';

const router = Router();

/**
 * GET /api/player/leaderboard
 * Top players by ELO (only players with at least one ranked game).
 * Declared before /:id so "leaderboard" is not treated as an id.
 */
router.get('/leaderboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const players = await Player.find({ $expr: { $gt: [{ $add: ['$rankedWins', '$rankedLosses'] }, 0] } })
      .sort({ elo: -1, rankedWins: -1 })
      .limit(10)
      .select('-_id name elo rankedWins rankedLosses');
    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar ranking.' });
  }
});

/**
 * GET /api/player/:id
 * Returns public player stats (elo, name, wins, losses).
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id || id.length > 64) {
    res.status(400).json({ message: 'ID inválido.' });
    return;
  }

  try {
    const player = await Player.findOne({ playerId: id }).select('-_id playerId name elo rankedWins rankedLosses');
    if (!player) {
      res.status(404).json({ message: 'Jogador não encontrado.' });
      return;
    }
    const rank = (await Player.countDocuments({
      elo: { $gt: player.elo },
      $expr: { $gt: [{ $add: ['$rankedWins', '$rankedLosses'] }, 0] },
    })) + 1;
    res.json({ ...player.toObject(), rank });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar jogador.' });
  }
});

/**
 * POST /api/player/register
 * Upsert player by playerId + name (called on first consent).
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { playerId, name } = req.body as { playerId?: string; name?: string };

  if (!playerId || playerId.length > 64) {
    res.status(400).json({ message: 'playerId inválido.' });
    return;
  }

  const safeName = (name ?? '').trim().slice(0, 20) || 'Jogador';

  try {
    const player = await Player.findOneAndUpdate(
      { playerId },
      { $setOnInsert: { playerId, elo: 1000, rankedWins: 0, rankedLosses: 0 }, $set: { name: safeName } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).select('-_id playerId name elo rankedWins rankedLosses');

    res.status(200).json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao registrar jogador.' });
  }
});

export default router;
