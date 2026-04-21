import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Board from '../components/Board';
import GameStatus from '../components/GameStatus';
import { useGame } from '../hooks/useGame';
import { chooseMove, Difficulty } from '../utils/aiLogic';

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Fácil', color: 'bg-green-600 hover:bg-green-500' },
  { value: 'medium', label: 'Médio', color: 'bg-yellow-600 hover:bg-yellow-500' },
  { value: 'hard', label: 'Difícil', color: 'bg-red-600 hover:bg-red-500' },
];

export default function CPUGame() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [cpuThinking, setCpuThinking] = useState(false);
  const { state, move, reset } = useGame();

  const handleMove = useCallback(
    (index: number) => {
      if (state.currentPlayer !== 'X' || state.winner) return;
      move(index);
    },
    [state, move],
  );

  useEffect(() => {
    if (!difficulty) return;
    if (state.currentPlayer !== 'O' || state.winner) return;

    setCpuThinking(true);
    const timer = setTimeout(() => {
      const cpuMove = chooseMove(state, difficulty);
      move(cpuMove);
      setCpuThinking(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [state, difficulty, move]);

  if (!difficulty) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 gap-6">
        <motion.div
          className="card w-full max-w-sm text-center space-y-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-black">🤖 vs CPU</h1>
          <p className="text-white/60 text-sm">Você é o X. Escolha a dificuldade:</p>

          <div className="space-y-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`btn w-full ${d.color} text-white`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <Link to="/" className="btn-ghost w-full text-sm">
            Voltar
          </Link>
        </motion.div>
      </div>
    );
  }

  const diffLabel = DIFFICULTIES.find((d) => d.value === difficulty)!.label;

  function handleReset() {
    reset();
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-black">🤖 vs CPU</h1>
        <span className="text-sm text-white/40 bg-white/10 px-3 py-1 rounded-full">
          {diffLabel}
        </span>
      </motion.div>

      <motion.div
        className="card w-full max-w-sm space-y-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {cpuThinking && (
          <p className="text-center text-white/50 text-sm animate-pulse">
            🤖 CPU pensando…
          </p>
        )}

        <GameStatus
          state={state}
          playerLabel={{ X: 'Você (X)', O: `CPU (O) — ${diffLabel}` }}
          onReset={handleReset}
        />
        <Board
          state={state}
          onMove={handleMove}
          disabled={state.currentPlayer === 'O' || cpuThinking}
        />

        <div className="flex gap-3 justify-center pt-2">
          <button onClick={handleReset} className="btn-ghost text-sm">
            Reiniciar
          </button>
          <button
            onClick={() => {
              reset();
              setDifficulty(null);
            }}
            className="btn-ghost text-sm"
          >
            Mudar dificuldade
          </button>
          <Link to="/" className="btn-ghost text-sm">
            Menu
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
