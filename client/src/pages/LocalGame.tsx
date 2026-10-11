import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Board from '../components/Board';
import GameStatus from '../components/GameStatus';
import PlayerSetup, { PlayerConfig } from '../components/PlayerSetup';
import { useGame } from '../hooks/useGame';
import { useReportResult } from '../hooks/useReportResult';

export default function LocalGame() {
  const navigate = useNavigate();
  const { state, moves, startedAt, move, reset } = useGame();
  const [config, setConfig] = useState<PlayerConfig | null>(null);

  useReportResult(state, moves, startedAt, 'local');

  function handleConfig(cfg: PlayerConfig) {
    setConfig(cfg);
    reset();
  }

  if (!config) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
        <motion.h1
          className="text-2xl font-black text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          👥 Dois Jogadores
        </motion.h1>
        <PlayerSetup mode="local" onConfirm={handleConfig} onBack={() => navigate('/')} />
      </div>
    );
  }

  const labelX = `${config.player1Name} (X)`;
  const labelO = `${config.player2Name ?? 'Jogador 2'} (O)`;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.h1
        className="text-xl sm:text-2xl font-black text-center break-words max-w-sm"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        👥 {config.player1Name} <span className="text-white/40">vs</span> {config.player2Name}
      </motion.h1>

      <motion.div
        className="card w-full max-w-sm space-y-5"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <GameStatus state={state} playerLabel={{ X: labelX, O: labelO }} />
        <Board state={state} onMove={move} />

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={reset}
            className={`col-span-2 text-sm ${state.winner ? 'btn-primary' : 'btn-ghost'}`}
          >
            {state.winner ? 'Jogar novamente' : 'Reiniciar'}
          </button>
          <button onClick={() => setConfig(null)} className="btn-ghost text-sm px-3">
            Trocar jogadores
          </button>
          <Link to="/" className="btn-ghost text-sm px-3 text-center">
            Menu
          </Link>
        </div>
      </motion.div>

      <p className="text-white/40 text-xs text-center max-w-xs">
        A peça com borda pontilhada laranja desaparece quando o dono dela jogar de novo.
      </p>
    </div>
  );
}
