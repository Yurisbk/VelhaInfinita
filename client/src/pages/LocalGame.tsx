import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Board from '../components/Board';
import GameStatus from '../components/GameStatus';
import { useGame } from '../hooks/useGame';

export default function LocalGame() {
  const { state, move, reset } = useGame();

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.h1
        className="text-2xl font-black text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        👥 Dois Jogadores
      </motion.h1>

      <motion.div
        className="card w-full max-w-sm space-y-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <GameStatus
          state={state}
          playerLabel={{ X: 'Jogador X', O: 'Jogador O' }}
          onReset={reset}
        />
        <Board state={state} onMove={move} />

        <div className="flex gap-3 justify-center pt-2">
          <button onClick={reset} className="btn-ghost text-sm">
            Reiniciar
          </button>
          <Link to="/" className="btn-ghost text-sm">
            Menu
          </Link>
        </div>
      </motion.div>

      <div className="text-white/40 text-xs text-center max-w-xs">
        Peça destacada com borda pontilhada vai desaparecer na próxima jogada daquele jogador.
      </div>
    </div>
  );
}
