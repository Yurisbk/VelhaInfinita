import { Router, Request, Response } from 'express';
import { GameRecord } from '../models/GameRecord';
import { optionalAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/', optionalAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalGames, byMode, byWinner] = await Promise.all([
      GameRecord.countDocuments(),
      GameRecord.aggregate([
        { $group: { _id: '$mode', count: { $sum: 1 } } },
      ]),
      GameRecord.aggregate([
        { $group: { _id: { mode: '$mode', winner: '$winner' }, count: { $sum: 1 } } },
      ]),
    ]);

    res.json({ totalGames, byMode, byWinner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar estatísticas.' });
  }
});

export default router;
