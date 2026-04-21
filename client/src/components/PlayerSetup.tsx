import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';

export type SetupMode = 'local' | 'cpu' | 'online';

interface PlayerSetupProps {
  mode: SetupMode;
  onConfirm: (config: PlayerConfig) => void;
  onBack?: () => void;
}

export interface PlayerConfig {
  /** Name of player 1 (or the human player in CPU/online mode) */
  player1Name: string;
  /** Name of player 2 (only used in local mode) */
  player2Name?: string;
  /** Symbol chosen by the human player (CPU = opposite, local = X always starts) */
  mySymbol: 'X' | 'O';
}

export default function PlayerSetup({ mode, onConfirm, onBack }: PlayerSetupProps) {
  const { playerName } = usePlayer();
  const [p1, setP1] = useState(playerName || '');
  const [p2, setP2] = useState('');
  const [symbol, setSymbol] = useState<'X' | 'O'>('X');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedP1 = p1.trim() || 'Jogador 1';
    const trimmedP2 = p2.trim() || 'Jogador 2';
    onConfirm({
      player1Name: trimmedP1,
      player2Name: mode === 'local' ? trimmedP2 : undefined,
      mySymbol: symbol,
    });
  }

  const title =
    mode === 'local' ? '👥 Dois Jogadores' :
    mode === 'cpu'   ? '🤖 vs CPU' :
                       '🌐 Modo Online';

  return (
    <motion.div
      className="card w-full max-w-sm space-y-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <h2 className="text-xl font-black text-center">{title}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1">
            {mode === 'local' ? 'Nome do Jogador 1 (X)' : 'Seu nome'}
          </label>
          <input
            type="text"
            className="input"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            placeholder={mode === 'local' ? 'Jogador 1' : 'Seu nome'}
            maxLength={20}
            autoFocus
          />
        </div>

        {mode === 'local' && (
          <div>
            <label className="block text-sm text-white/60 mb-1">Nome do Jogador 2 (O)</label>
            <input
              type="text"
              className="input"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              placeholder="Jogador 2"
              maxLength={20}
            />
          </div>
        )}

        {mode !== 'local' && (
          <div>
            <label className="block text-sm text-white/60 mb-2">Jogar como</label>
            <div className="flex gap-3">
              {(['X', 'O'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSymbol(s)}
                  className={`flex-1 py-3 rounded-xl font-black text-lg transition-all ${
                    symbol === s
                      ? s === 'X'
                        ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-300'
                        : 'bg-pink-500/30 border-2 border-pink-400 text-pink-300'
                      : 'bg-white/5 border-2 border-white/10 text-white/40 hover:border-white/30'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {mode === 'cpu' && (
              <p className="text-xs text-white/30 mt-2 text-center">
                {symbol === 'X' ? 'Você joga primeiro' : 'CPU joga primeiro'}
              </p>
            )}
          </div>
        )}

        <button type="submit" className="btn-primary w-full">
          Jogar
        </button>

        {onBack && (
          <button type="button" onClick={onBack} className="btn-ghost w-full text-sm">
            ← Voltar
          </button>
        )}
      </form>
    </motion.div>
  );
}
