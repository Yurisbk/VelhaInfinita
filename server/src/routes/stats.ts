import { Router, Request, Response } from 'express';
import { GameRecord, DIFFICULTIES, Difficulty } from '../models/GameRecord';
import {
  gamesStartedTotal,
  gamesWonTotal,
  gameDurationSeconds,
  gameMoves,
  cpuGamesTotal,
} from '../utils/metrics';

const router = Router();

router.get('/', async (_req: Request, res: Response): Promise<void> => {
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

/**
 * POST /api/stats/game
 * Local and CPU games run entirely in the browser; the client reports the
 * result here so they show up in the metrics. Online modes are recorded by
 * the socket server and are rejected here.
 */
router.post('/game', (req: Request, res: Response): void => {
  const { mode, winner, moves, durationSeconds, difficulty, humanSymbol } = req.body as Record<string, unknown>;

  const validMoves =
    Array.isArray(moves) &&
    moves.length <= 500 &&
    moves.every((m) => Number.isInteger(m) && (m as number) >= 0 && (m as number) <= 8);

  if (
    (mode !== 'local' && mode !== 'cpu') ||
    (winner !== 'X' && winner !== 'O') ||
    !validMoves ||
    typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds) ||
    durationSeconds < 0 || durationSeconds > 24 * 3600 ||
    (mode === 'cpu' && (!DIFFICULTIES.includes(difficulty as Difficulty) || (humanSymbol !== 'X' && humanSymbol !== 'O')))
  ) {
    res.status(400).json({ message: 'Partida inválida.' });
    return;
  }

  const moveList = moves as number[];
  const duration = Math.round(durationSeconds);
  const humanWon = mode === 'cpu' ? winner === humanSymbol : undefined;

  gamesStartedTotal.inc({ mode });
  gamesWonTotal.inc({ mode, winner });
  gameDurationSeconds.observe({ mode }, duration);
  gameMoves.observe({ mode }, moveList.length);
  if (mode === 'cpu') {
    cpuGamesTotal.inc({ difficulty: difficulty as string, result: humanWon ? 'human' : 'cpu' });
  }

  GameRecord.create({
    mode,
    winner,
    moves: moveList,
    durationSeconds: duration,
    difficulty: mode === 'cpu' ? difficulty : undefined,
    humanWon,
  }).catch(console.error);

  res.status(201).json({ ok: true });
});

export default router;
