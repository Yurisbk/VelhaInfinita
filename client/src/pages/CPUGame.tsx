import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Board from '../components/Board';
import GameStatus from '../components/GameStatus';
import PlayerSetup, { PlayerConfig } from '../components/PlayerSetup';
import { useGame } from '../hooks/useGame';
import { chooseMove, Difficulty } from '../utils/aiLogic';

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Fácil', color: 'bg-green-600 hover:bg-green-500' },
  { value: 'medium', label: 'Médio', color: 'bg-yellow-600 hover:bg-yellow-500' },
  { value: 'hard', label: 'Difícil', color: 'bg-red-600 hover:bg-red-500' },
  { value: 'insane', label: 'Insano', color: 'bg-purple-800 hover:bg-purple-700' },
];

export default function CPUGame() {
  const [config, setConfig] = useState<PlayerConfig | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [cpuThinking, setCpuThinking] = useState(false);
  const { state, move, reset } = useGame();

  const humanSymbol = config?.mySymbol ?? 'X';
  const cpuSymbol = humanSymbol === 'X' ? 'O' : 'X';

  const handleMove = useCallback(
    (index: number) => {
      if (state.currentPlayer !== humanSymbol || state.winner) return;
      move(index);
    },
    [state, move, humanSymbol],
  );

  useEffect(() => {
    if (!difficulty || !config) return;
    if (state.currentPlayer !== cpuSymbol || state.winner) return;

    setCpuThinking(true);
    const timer = setTimeout(() => {
      const cpuMove = chooseMove(state, difficulty);
      move(cpuMove);
      setCpuThinking(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [state, difficulty, move, cpuSymbol, config]);

  function handleConfig(cfg: PlayerConfig) {
    setConfig(cfg);
    reset();
  }

  if (!config) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 gap-6">
        <motion.h1
          className="text-2xl font-black"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          🤖 vs CPU
        </motion.h1>
        <PlayerSetup
          mode="cpu"
          onConfirm={handleConfig}
          onBack={() => window.history.back()}
        />
      </div>
    );
  }

  if (!difficulty) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 gap-6">
        <motion.div
          className="card w-full max-w-sm text-center space-y-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-black">🤖 vs CPU</h1>
          <p className="text-white/60 text-sm">Escolha a dificuldade:</p>

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

          <button onClick={() => setConfig(null)} className="btn-ghost block w-full text-center text-sm">
            ← Voltar
          </button>
        </motion.div>
      </div>
    );
  }

  const diffLabel = DIFFICULTIES.find((d) => d.value === difficulty)!.label;
  const playerLabel = {
    [humanSymbol]: `${config.player1Name} (${humanSymbol})`,
    [cpuSymbol]: `CPU (${cpuSymbol}) — ${diffLabel}`,
  } as { X: string; O: string };

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
          playerLabel={playerLabel}
          onReset={() => { reset(); }}
        />
        <Board
          state={state}
          onMove={handleMove}
          disabled={state.currentPlayer === cpuSymbol || cpuThinking}
        />

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center pt-2">
          <button onClick={() => { reset(); }} className="btn-ghost text-sm w-full sm:w-auto">
            Reiniciar
          </button>
          <button
            onClick={() => {
              reset();
              setDifficulty(null);
            }}
            className="btn-ghost text-sm w-full sm:w-auto"
          >
            Mudar dificuldade
          </button>
          <button
            onClick={() => {
              reset();
              setConfig(null);
              setDifficulty(null);
            }}
            className="btn-ghost text-sm w-full sm:w-auto"
          >
            Mudar símbolo
          </button>
          <Link to="/" className="btn-ghost text-sm text-center w-full sm:w-auto">
            Menu
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
