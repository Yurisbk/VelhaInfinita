import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PlayerSetup, { PlayerConfig } from '../components/PlayerSetup';
import OnlineMatch, { ErrorBanner } from '../components/OnlineMatch';
import { useMatchSocket } from '../hooks/useMatchSocket';

export default function OnlineGame() {
  const navigate = useNavigate();
  const match = useMatchSocket();
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const myName = playerConfig?.player1Name || 'Você';
  const { phase } = match;

  function handleJoin() {
    if (inputCode.trim().length < 4 || !playerConfig) return;
    match.joinRoom(inputCode, playerConfig.player1Name);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(match.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.h1
        className="text-2xl font-black text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🌐 Online com Amigo
      </motion.h1>

      <ErrorBanner message={match.error} />

      {/* No AnimatePresence here: phase changes must render immediately, even in a background tab */}
        {!playerConfig && (
          <motion.div key="setup" className="w-full flex justify-center" exit={{ opacity: 0 }}>
            <PlayerSetup
              mode="online"
              submitLabel="Continuar"
              symbolHint="Vale para quem cria a sala — quem entra fica com o outro símbolo"
              onConfirm={setPlayerConfig}
              onBack={() => navigate('/')}
            />
          </motion.div>
        )}

        {playerConfig && phase === 'idle' && (
          <motion.div
            key="lobby"
            className="card w-full max-w-sm flex flex-col gap-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              onClick={() => match.createRoom(playerConfig.player1Name, playerConfig.mySymbol)}
              className="btn-primary w-full"
            >
              Criar sala
            </button>

            <div className="flex items-center gap-3 text-white/30 text-xs">
              <span className="flex-1 h-px bg-white/10" /> ou <span className="flex-1 h-px bg-white/10" />
            </div>

            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
            >
              <input
                type="text"
                className="input uppercase tracking-widest text-center font-bold"
                placeholder="CÓDIGO DA SALA"
                aria-label="Código da sala"
                maxLength={4}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              />
              <button type="submit" className="btn-secondary w-full" disabled={inputCode.length < 4}>
                Entrar na sala
              </button>
            </form>

            <button onClick={() => setPlayerConfig(null)} className="btn-ghost w-full text-sm">
              ← Voltar
            </button>
          </motion.div>
        )}

        {phase === 'waiting' && (
          <motion.div
            key="waiting"
            className="card w-full max-w-sm text-center space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-white/60 animate-pulse">Aguardando oponente…</p>
            <div className="bg-primary/20 rounded-2xl py-6 px-4">
              <p className="text-xs text-white/40 mb-2">Código da sala</p>
              <p className="text-5xl font-black tracking-widest text-indigo-300 select-all">{match.roomCode}</p>
            </div>
            <button onClick={handleCopy} className="btn-primary w-full text-sm">
              {copied ? 'Copiado!' : 'Copiar código'}
            </button>
            <p className="text-sm text-white/40">Compartilhe o código com seu amigo</p>
            <button onClick={match.leave} className="btn-ghost w-full text-sm">
              Cancelar
            </button>
          </motion.div>
        )}

        {(phase === 'playing' || phase === 'ended') && (
          <OnlineMatch match={match} myName={myName} />
        )}
    </div>
  );
}
