import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PlayerSetup, { PlayerConfig } from '../components/PlayerSetup';
import OnlineMatch, { ErrorBanner, SearchingCard } from '../components/OnlineMatch';
import Leaderboard from '../components/Leaderboard';
import { useMatchSocket } from '../hooks/useMatchSocket';
import { usePlayer } from '../context/PlayerContext';
import { api, PlayerStats } from '../services/api';

export default function RankedMatch() {
  const navigate = useNavigate();
  const { playerId, playerName } = usePlayer();
  const match = useMatchSocket();
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const [me, setMe] = useState<PlayerStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerStats[] | null>(null);
  const { phase } = match;

  // Refresh ranking whenever we are back on the setup screen (e.g. after a game).
  useEffect(() => {
    if (phase !== 'idle') return;
    let cancelled = false;
    api.getPlayer(playerId).then((p) => { if (!cancelled) setMe(p); });
    api.getLeaderboard()
      .then((list) => { if (!cancelled) setLeaderboard(list); })
      .catch(() => { if (!cancelled) setLeaderboard([]); });
    return () => { cancelled = true; };
  }, [phase, playerId]);

  function handleSearch(cfg: PlayerConfig) {
    setPlayerConfig(cfg);
    match.search('ranked', { name: cfg.player1Name, symbol: cfg.mySymbol, playerId });
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.h1
        className="text-2xl font-black text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🏆 Partida Ranqueada
      </motion.h1>

      <ErrorBanner message={match.error} />

      {/* No AnimatePresence here: phase changes must render immediately, even in a background tab */}
        {phase === 'idle' && (
          <motion.div
            key="setup"
            className="w-full flex flex-col items-center gap-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="card w-full max-w-sm flex items-center justify-around text-center py-4">
              <div>
                <p className="text-2xl font-black text-yellow-400 tabular-nums">{me?.elo ?? 1000}</p>
                <p className="text-white/50 text-xs mt-1">Seu ELO</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-2xl font-black tabular-nums">{me?.rank ? `#${me.rank}` : '—'}</p>
                <p className="text-white/50 text-xs mt-1">Posição</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-2xl font-black tabular-nums">
                  <span className="text-green-400">{me?.rankedWins ?? 0}</span>
                  <span className="text-white/30 text-base"> / </span>
                  <span className="text-red-400">{me?.rankedLosses ?? 0}</span>
                </p>
                <p className="text-white/50 text-xs mt-1">V / D</p>
              </div>
            </div>

            <PlayerSetup
              mode="online"
              submitLabel="Procurar partida ranqueada"
              symbolHint="Preferência — se os dois escolherem o mesmo, é sorteado"
              onConfirm={handleSearch}
              onBack={() => navigate('/')}
            />

            <div className="card w-full max-w-sm space-y-3">
              <p className="font-bold text-sm text-white/70">Top 10</p>
              <Leaderboard players={leaderboard} highlightName={me ? me.name : playerName} />
              <p className="text-white/30 text-xs text-center">
                Vitória ganha e derrota perde ELO (K=32). Abandonar conta como derrota.
              </p>
            </div>
          </motion.div>
        )}

        {phase === 'searching' && (
          <SearchingCard
            title="Procurando oponente ranqueado…"
            queuePosition={match.queuePosition}
            onCancel={match.cancelSearch}
            spinnerClass="border-yellow-400"
          />
        )}

        {(phase === 'playing' || phase === 'ended') && (
          <OnlineMatch
            match={match}
            myName={playerConfig?.player1Name || 'Você'}
            accentClass="bg-yellow-500/30 text-yellow-300"
          />
        )}
    </div>
  );
}
