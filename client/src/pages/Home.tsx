import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface PlayerStats {
  elo: number;
  rankedWins: number;
  rankedLosses: number;
  name: string;
}

const modes = [
  {
    to: '/local',
    emoji: '👥',
    title: 'Local 2 Jogadores',
    desc: 'Dois jogadores no mesmo dispositivo',
    color: 'from-indigo-600 to-violet-600',
    glow: 'shadow-indigo-500/30',
  },
  {
    to: '/partida-rapida',
    emoji: '⚡',
    title: 'Partida Rápida',
    desc: 'Seja pareado com um jogador aleatório',
    color: 'from-yellow-500 to-orange-500',
    glow: 'shadow-yellow-500/30',
  },
  {
    to: '/ranqueado',
    emoji: '🏆',
    title: 'Ranqueado',
    desc: 'Suba no ranking — ELO em jogo',
    color: 'from-amber-500 to-yellow-400',
    glow: 'shadow-amber-500/30',
  },
  {
    to: '/online',
    emoji: '🌐',
    title: 'Online com Amigo',
    desc: 'Crie ou entre em uma sala com código',
    color: 'from-cyan-600 to-blue-600',
    glow: 'shadow-cyan-500/30',
  },
  {
    to: '/cpu',
    emoji: '🤖',
    title: 'vs CPU',
    desc: 'Desafie a inteligência artificial',
    color: 'from-pink-600 to-rose-600',
    glow: 'shadow-pink-500/30',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  const { playerName, playerId } = usePlayer();
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    if (!playerId) return;
    fetch(`${API_BASE}/api/player/${playerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PlayerStats | null) => { if (data) setStats(data); })
      .catch(() => {});
  }, [playerId]);

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl sm:text-6xl font-black mb-4 bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
          ♾️ Velha Infinita
        </h1>
        <p className="text-white/60 text-base sm:text-lg max-w-md mx-auto">
          Cada jogador tem apenas <span className="text-white font-semibold">3 peças</span>.
          Na 4ª jogada, a mais antiga desaparece. Nunca empata!
        </p>
        {playerName && (
          <p className="text-primary mt-4 font-semibold">
            Bem-vindo, {playerName}! 👋
          </p>
        )}
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 w-full max-w-2xl grid-cols-1 sm:grid-cols-2"
      >
        {modes.map((mode) => (
          <motion.div key={mode.to} variants={item}>
            <Link
              to={mode.to}
              className={`block card bg-gradient-to-br ${mode.color} shadow-xl ${mode.glow} hover:scale-105 transition-transform duration-200 text-center`}
            >
              <div className="text-5xl mb-3">{mode.emoji}</div>
              <h2 className="font-bold text-lg mb-1">{mode.title}</h2>
              <p className="text-white/70 text-sm">{mode.desc}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* ELO Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 card max-w-md w-full"
      >
        {stats ? (
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-2xl font-black text-yellow-400">{stats.elo}</p>
              <p className="text-white/50 text-xs mt-1">ELO</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-2xl font-black text-green-400">{stats.rankedWins}</p>
              <p className="text-white/50 text-xs mt-1">Vitórias</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-2xl font-black text-red-400">{stats.rankedLosses}</p>
              <p className="text-white/50 text-xs mt-1">Derrotas</p>
            </div>
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center">
            Jogue uma partida ranqueada para ver seu ELO aqui.
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6 card max-w-md w-full text-center text-white/60 text-sm"
      >
        <p className="font-semibold text-white mb-2">📖 Como funciona</p>
        <ol className="text-left space-y-1 list-decimal list-inside">
          <li>Cada jogador coloca uma peça por vez no tabuleiro</li>
          <li>Ao chegar na <strong className="text-white">4ª peça</strong>, a mais antiga some</li>
          <li>A peça que vai sumir fica <strong className="text-orange-400">destacada</strong> antes</li>
          <li>Vence quem formar <strong className="text-white">3 em linha</strong> primeiro</li>
        </ol>
      </motion.div>
    </div>
  );
}
