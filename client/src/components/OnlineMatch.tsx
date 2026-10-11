import { motion, AnimatePresence } from 'framer-motion';
import Board from './Board';
import GameStatus from './GameStatus';
import { MatchSocket } from '../hooks/useMatchSocket';

export function ErrorBanner({ message }: { message: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="alert"
          className="w-full max-w-sm bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm text-center"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SearchingCardProps {
  title: string;
  queuePosition: number;
  onCancel: () => void;
  spinnerClass?: string;
}

export function SearchingCard({ title, queuePosition, onCancel, spinnerClass = 'border-primary' }: SearchingCardProps) {
  return (
    <motion.div
      key="searching"
      className="card w-full max-w-sm text-center space-y-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="space-y-2">
        <div className="flex justify-center pb-2">
          <motion.div
            className={`w-16 h-16 rounded-full border-4 border-t-transparent ${spinnerClass}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <p className="text-lg font-bold">{title}</p>
        <p className="text-white/40 text-sm">Posição na fila: #{queuePosition}</p>
        <p className="text-white/30 text-xs">A busca expira em 60 segundos</p>
      </div>
      <button onClick={onCancel} className="btn-ghost w-full text-sm">
        Cancelar
      </button>
    </motion.div>
  );
}

interface OnlineMatchProps {
  match: MatchSocket;
  myName: string;
  /** Tailwind classes for the "your turn" pill */
  accentClass?: string;
  onExit?: () => void;
}

/** Board card shared by every online mode (playing + ended phases). */
export default function OnlineMatch({
  match,
  myName,
  accentClass = 'bg-primary/30 text-indigo-300',
  onExit,
}: OnlineMatchProps) {
  const { phase, mySymbol, opponentName, gameState, isMyTurn, rematchState, opponentLeft, eloChange } = match;
  const opponent = opponentName || 'Oponente';
  const labels = {
    X: mySymbol === 'X' ? `${myName} (X)` : `${opponent} (X)`,
    O: mySymbol === 'O' ? `${myName} (O)` : `${opponent} (O)`,
  };
  const ended = phase === 'ended';
  const leftMsg =
    opponentLeft === 'abandoned' ? '🏆 O oponente abandonou — vitória sua!' :
    opponentLeft === 'left' ? 'O oponente saiu da sala.' : '';

  return (
    <motion.div
      key="game"
      className="card w-full max-w-sm space-y-5"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span
          className={`font-semibold px-3 py-1 rounded-full transition-colors truncate max-w-full ${
            isMyTurn ? accentClass : 'bg-white/10 text-white/50'
          }`}
        >
          Você é {mySymbol}{isMyTurn ? ' — sua vez!' : ''}
        </span>
        <span className="text-white/50 truncate max-w-full">vs {opponent}</span>
      </div>

      <GameStatus state={gameState} playerLabel={labels} />

      <Board state={gameState} onMove={match.move} disabled={!isMyTurn} />

      <AnimatePresence>
        {ended && (
          <motion.div
            className="flex flex-col gap-3 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {leftMsg && <p className="text-white/70 text-sm">{leftMsg}</p>}

            {eloChange && (
              <p className={`text-lg font-bold ${eloChange.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ELO: {eloChange.newElo} ({eloChange.delta >= 0 ? '+' : ''}{eloChange.delta})
              </p>
            )}

            {!opponentLeft && rematchState === 'idle' && (
              <button onClick={match.requestRematch} className="btn-primary w-full">
                Revanche
              </button>
            )}
            {!opponentLeft && rematchState === 'waiting' && (
              <p className="text-white/50 text-sm animate-pulse py-3">
                Aguardando oponente aceitar a revanche…
              </p>
            )}
            {!opponentLeft && rematchState === 'opponent_wants' && (
              <>
                <p className="text-yellow-400 text-sm font-semibold">Oponente quer revanche!</p>
                <button onClick={match.requestRematch} className="btn-primary w-full">
                  Aceitar revanche
                </button>
              </>
            )}
            {!opponentLeft && (
              <p className="text-white/30 text-xs">Na revanche os símbolos se invertem.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={onExit ?? match.leave} className="btn-ghost w-full text-sm">
        {ended ? '← Voltar' : 'Desistir da partida'}
      </button>
    </motion.div>
  );
}
