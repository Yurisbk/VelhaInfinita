import { motion } from 'framer-motion';
import { GameState } from '../utils/gameLogic';

interface GameStatusProps {
  state: GameState;
  playerLabel?: { X: string; O: string };
}

export default function GameStatus({
  state,
  playerLabel = { X: 'Jogador X', O: 'Jogador O' },
}: GameStatusProps) {
  const { winner, currentPlayer, fadingCell } = state;

  const message = winner
    ? `🏆 ${playerLabel[winner]} venceu!`
    : `Vez de ${playerLabel[currentPlayer]}`;
  const subMessage =
    !winner && fadingCell !== null
      ? '⚠️ A peça destacada some nesta jogada'
      : '';

  return (
    <div className="text-center space-y-1">
      {/* Entry animation only: the text must never wait on an exit animation,
          otherwise fast moves (or a background tab, where animation frames are
          paused) can leave a stale message on screen. */}
      <motion.p
        key={message}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        aria-live="polite"
        className={`text-lg sm:text-xl font-bold break-words ${
          winner ? 'text-yellow-400' : 'text-white'
        }`}
      >
        {message}
      </motion.p>

      {/* Fixed-height line so the board does not jump when the warning appears */}
      <p className="min-h-[1.25rem] text-sm text-orange-400">
        {subMessage && <span className="animate-pulse">{subMessage}</span>}
      </p>
    </div>
  );
}
