import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Board from '../components/Board';
import GameStatus from '../components/GameStatus';
import PlayerSetup, { PlayerConfig } from '../components/PlayerSetup';
import { useGame } from '../hooks/useGame';
import { useReportResult } from '../hooks/useReportResult';
import { chooseMove, Difficulty } from '../utils/aiLogic';

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Fácil', color: 'bg-green-600 hover:bg-green-500' },
  { value: 'medium', label: 'Médio', color: 'bg-yellow-600 hover:bg-yellow-500' },
  { value: 'hard', label: 'Difícil', color: 'bg-red-600 hover:bg-red-500' },
  { value: 'insane', label: 'Insano', color: 'bg-purple-800 hover:bg-purple-700' },
];

const CPU_DELAY_MS = 400;

export default function CPUGame() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<PlayerConfig | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const { state, moves, startedAt, move, reset } = useGame();

  const humanSymbol = config?.mySymbol ?? 'X';
  const cpuSymbol = humanSymbol === 'X' ? 'O' : 'X';
  // Derived, not stored: it can never get stuck if the game is reset mid-think.
  const cpuTurn = !!config && !!difficulty && !state.winner && state.currentPlayer === cpuSymbol;

  useReportResult(state, moves, startedAt, 'cpu', {
    difficulty: difficulty ?? undefined,
    humanSymbol,
  });

  const handleMove = useCallback(
    (index: number) => {
      if (state.currentPlayer !== humanSymbol || state.winner) return;
      move(index);
    },
    [state, move, humanSymbol],
  );

  useEffect(() => {
    if (!cpuTurn || !difficulty) return;
    const timer = setTimeout(() => move(chooseMove(state, difficulty)), CPU_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cpuTurn, state, difficulty, move]);

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
          🤖 vs CPU
        </motion.h1>
        <PlayerSetup mode="cpu" submitLabel="Continuar" onConfirm={handleConfig} onBack={() => navigate('/')} />
      </div>
    );
  }

  if (!difficulty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
        <motion.h1
          className="text-2xl font-black text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          🤖 vs CPU
        </motion.h1>
        <motion.div
          className="card w-full max-w-sm text-center space-y-5"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-white/60 text-sm">Escolha a dificuldade</p>

          <div className="space-y-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => { reset(); setDifficulty(d.value); }}
                className={`btn w-full ${d.color} text-white`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button onClick={() => setConfig(null)} className="btn-ghost w-full text-sm">
            ← Voltar
          </button>
        </motion.div>
      </div>
    );
  }

  const diffLabel = DIFFICULTIES.find((d) => d.value === difficulty)!.label;
  const playerLabel = {
    [humanSymbol]: `${config.player1Name} (${humanSymbol})`,
    [cpuSymbol]: `CPU (${cpuSymbol})`,
  } as { X: string; O: string };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-black">🤖 vs CPU</h1>
        <span className="text-sm text-white/60 bg-white/10 px-3 py-1 rounded-full">
          {diffLabel}
        </span>
      </motion.div>

      <motion.div
        className="card w-full max-w-sm space-y-5"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <GameStatus state={state} playerLabel={playerLabel} />
        <Board state={state} onMove={handleMove} disabled={cpuTurn} />

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={reset}
            className={`col-span-2 text-sm ${state.winner ? 'btn-primary' : 'btn-ghost'}`}
          >
            {state.winner ? 'Jogar novamente' : 'Reiniciar'}
          </button>
          <button onClick={() => setDifficulty(null)} className="btn-ghost text-sm px-3">
            Dificuldade
          </button>
          <button
            onClick={() => { setConfig(null); setDifficulty(null); }}
            className="btn-ghost text-sm px-3"
          >
            Trocar símbolo
          </button>
          <Link to="/" className="col-span-2 btn-ghost text-sm text-center">
            Menu
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
