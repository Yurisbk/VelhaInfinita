import { Router, Request, Response } from 'express';
import { Player } from '../models/Player';

const router = Router();

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
    res.json(player);
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
