import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PlayerSetup, { PlayerConfig } from '../components/PlayerSetup';
import OnlineMatch, { ErrorBanner, SearchingCard } from '../components/OnlineMatch';
import { useMatchSocket } from '../hooks/useMatchSocket';

export default function QuickMatch() {
  const navigate = useNavigate();
  const match = useMatchSocket();
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const { phase } = match;

  function handleSearch(cfg: PlayerConfig) {
    setPlayerConfig(cfg);
    match.search('quickmatch', { name: cfg.player1Name, symbol: cfg.mySymbol });
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.h1
        className="text-2xl font-black text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        ⚡ Partida Rápida
      </motion.h1>

      <ErrorBanner message={match.error} />

      {/* No AnimatePresence here: phase changes must render immediately, even in a background tab */}
        {phase === 'idle' && (
          <motion.div
            key="setup"
            className="w-full flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <PlayerSetup
              mode="online"
              submitLabel="Procurar oponente"
              symbolHint="Preferência — se os dois escolherem o mesmo, é sorteado"
              onConfirm={handleSearch}
              onBack={() => navigate('/')}
            />
            <p className="text-white/30 text-xs text-center max-w-xs">
              Você será pareado com alguém que também está procurando.
            </p>
          </motion.div>
        )}

        {phase === 'searching' && (
          <SearchingCard
            title="Procurando oponente…"
            queuePosition={match.queuePosition}
            onCancel={match.cancelSearch}
          />
        )}

        {(phase === 'playing' || phase === 'ended') && (
          <OnlineMatch match={match} myName={playerConfig?.player1Name || 'Você'} />
        )}
    </div>
  );
}
