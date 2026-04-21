import { motion, AnimatePresence } from 'framer-motion';
import { GameState } from '../utils/gameLogic';

interface GameStatusProps {
  state: GameState;
  playerLabel?: { X: string; O: string };
  onReset?: () => void;
}

export default function GameStatus({
  state,
  playerLabel = { X: 'Jogador X', O: 'Jogador O' },
  onReset,
}: GameStatusProps) {
  const { winner, currentPlayer, fadingCell } = state;

  let message = '';
  let subMessage = '';

  if (winner) {
    message = `🏆 ${playerLabel[winner]} venceu!`;
  } else {
    message = `Vez de ${playerLabel[currentPlayer]}`;
    if (fadingCell !== null) {
      subMessage = `⚠️ Sua peça mais antiga vai sumir na próxima jogada`;
    }
  }

  return (
    <div className="text-center space-y-2">
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`text-lg sm:text-xl font-bold ${
            winner ? 'text-yellow-400' : 'text-white'
          }`}
        >
          {message}
        </motion.p>
      </AnimatePresence>

      {subMessage && (
        <p className="text-sm sm:text-base text-orange-400 animate-pulse">{subMessage}</p>
      )}

      {winner && onReset && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="btn-primary mt-2"
          onClick={onReset}
        >
          Jogar Novamente
        </motion.button>
      )}
    </div>
  );
}
