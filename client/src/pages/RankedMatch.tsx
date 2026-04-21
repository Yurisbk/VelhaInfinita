import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import Board from '../components/Board';
import GameStatus from '../components/GameStatus';
import PlayerSetup, { PlayerConfig } from '../components/PlayerSetup';
import { GameState, createInitialState } from '../utils/gameLogic';
import { usePlayer } from '../context/PlayerContext';

type Phase = 'setup' | 'searching' | 'playing' | 'ended';
type RematchState = 'idle' | 'waiting' | 'opponent_wants';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    const serverUrl = import.meta.env.VITE_API_URL ?? '';
    socket = io(serverUrl, { transports: ['websocket', 'polling'] });
  }
  return socket;
}

export default function RankedMatch() {
  const { playerId } = usePlayer();

  const [phase, setPhase]               = useState<Phase>('setup');
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);
  const [mySymbol, setMySymbol]         = useState<'X' | 'O' | null>(null);
  const [opponentName, setOpponentName] = useState('');
  const [gameState, setGameState]       = useState<GameState>(createInitialState);
  const [statusMsg, setStatusMsg]       = useState('');
  const [error, setError]               = useState('');
  const [rematchState, setRematchState] = useState<RematchState>('idle');
  const [queuePosition, setQueuePosition] = useState(1);
  const [eloChange, setEloChange]       = useState<{ newElo: number; delta: number } | null>(null);

  useEffect(() => {
    const s = getSocket();

    s.on('queue_joined', ({ position }: { position: number }) => setQueuePosition(position));
    s.on('queue_timeout', () => {
      setError('Tempo esgotado. Nenhum oponente encontrado.');
      setPhase('setup');
    });
    s.on('queue_left', () => setPhase('setup'));

    s.on('game_start', ({ symbol, opponentName: name }: { symbol: 'X' | 'O'; opponentName?: string }) => {
      setMySymbol(symbol);
      if (name) setOpponentName(name);
      setPhase('playing');
      setStatusMsg('');
      setRematchState('idle');
      setEloChange(null);
    });

    s.on('game_update', (state: GameState) => {
      setGameState(state);
      if (state.winner) setPhase('ended');
    });

    s.on('elo_update', (data: { newElo: number; delta: number }) => {
      setEloChange(data);
    });

    s.on('opponent_left', ({ winner }: { winner: 'X' | 'O' | null }) => {
      if (winner) {
        setGameState((prev) => ({ ...prev, winner }));
        setStatusMsg('🏆 Oponente saiu — você venceu!');
      } else {
        setStatusMsg('Oponente saiu da partida.');
      }
      setPhase('ended');
      setRematchState('idle');
    });

    s.on('rematch_requested', () => setRematchState('opponent_wants'));
    s.on('rematch_expired',   () => setRematchState('idle'));
    s.on('error', (msg: string) => setError(msg));

    return () => {
      s.off('queue_joined');
      s.off('queue_timeout');
      s.off('queue_left');
      s.off('game_start');
      s.off('game_update');
      s.off('elo_update');
      s.off('opponent_left');
      s.off('rematch_requested');
      s.off('rematch_expired');
      s.off('error');
    };
  }, []);

  const handleSearch = useCallback(
    (cfg: PlayerConfig) => {
      setPlayerConfig(cfg);
      setError('');
      getSocket().emit('join_ranked_queue', {
        name: cfg.player1Name,
        symbol: cfg.mySymbol ?? 'X',
        playerId,
      });
      setPhase('searching');
    },
    [playerId],
  );

  const handleCancelSearch = useCallback(() => {
    getSocket().emit('leave_queue');
  }, []);

  const handleMove = useCallback(
    (index: number) => {
      if (mySymbol !== gameState.currentPlayer) return;
      getSocket().emit('make_move', index);
    },
    [mySymbol, gameState.currentPlayer],
  );

  const handleRequestRematch = useCallback(() => {
    getSocket().emit('request_rematch');
    setRematchState('waiting');
  }, []);

  const handleLeave = useCallback(() => {
    getSocket().emit('leave_room');
    socket?.disconnect();
    socket = null;
    setPhase('setup');
    setMySymbol(null);
    setOpponentName('');
    setGameState(createInitialState());
    setStatusMsg('');
    setError('');
    setRematchState('idle');
    setEloChange(null);
  }, []);

  const isMyTurn = mySymbol === gameState.currentPlayer;
  const myName   = playerConfig?.player1Name || 'Você';
  const myLabelX = mySymbol === 'X' ? `${myName} (X)` : `${opponentName || 'Oponente'} (X)`;
  const myLabelO = mySymbol === 'O' ? `${myName} (O)` : `${opponentName || 'Oponente'} (O)`;

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.h1
        className="text-2xl font-black"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🏆 Partida Ranqueada
      </motion.h1>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <PlayerSetup mode="online" onConfirm={handleSearch} onBack={() => window.history.back()} />
            <p className="text-white/30 text-xs text-center mt-4">
              ELO em jogo — jogue de forma ranqueada contra outros jogadores.
            </p>
          </motion.div>
        )}

        {phase === 'searching' && (
          <motion.div
            key="searching"
            className="card w-full max-w-sm text-center space-y-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="space-y-2">
              <div className="flex justify-center">
                <motion.div
                  className="w-16 h-16 rounded-full border-4 border-yellow-400 border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <p className="text-lg font-bold">Procurando oponente ranqueado…</p>
              <p className="text-white/40 text-sm">Posição na fila: #{queuePosition}</p>
              <p className="text-white/30 text-xs">Timeout em 60 segundos</p>
            </div>
            <button onClick={handleCancelSearch} className="btn-ghost w-full text-sm">
              Cancelar
            </button>
          </motion.div>
        )}

        {(phase === 'playing' || phase === 'ended') && (
          <motion.div
            key="game"
            className="card w-full max-w-sm space-y-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center justify-between text-sm">
              <span className={`font-semibold px-3 py-1 rounded-full ${isMyTurn ? 'bg-yellow-500/30 text-yellow-400' : 'bg-white/10 text-white/40'}`}>
                {myName} ({mySymbol}) {isMyTurn && phase === 'playing' ? '— sua vez!' : ''}
              </span>
              <span className="text-white/50 text-sm">vs {opponentName || 'Oponente'}</span>
            </div>

            {statusMsg && <p className="text-center text-white/60 text-sm">{statusMsg}</p>}

            {phase === 'ended' && eloChange && (
              <motion.div
                className={`text-center text-lg font-bold ${eloChange.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                ELO: {eloChange.newElo} ({eloChange.delta >= 0 ? '+' : ''}{eloChange.delta})
              </motion.div>
            )}

            <GameStatus
              state={gameState}
              playerLabel={{ X: myLabelX, O: myLabelO }}
            />

            <AnimatePresence>
              {phase === 'ended' && (
                <motion.div
                  className="flex flex-col gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {rematchState === 'idle' && (
                    <button onClick={handleRequestRematch} className="btn-primary w-full">
                      Jogar Novamente
                    </button>
                  )}
                  {rematchState === 'waiting' && (
                    <div className="text-center text-white/50 text-sm animate-pulse py-2">
                      Aguardando oponente aceitar revanche…
                    </div>
                  )}
                  {rematchState === 'opponent_wants' && (
                    <div className="flex flex-col gap-2">
                      <p className="text-center text-yellow-400 text-sm font-semibold">
                        Oponente quer revanche!
                      </p>
                      <button onClick={handleRequestRematch} className="btn-primary w-full">
                        Aceitar Revanche
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <Board
              state={gameState}
              onMove={handleMove}
              disabled={!isMyTurn || phase === 'ended'}
            />

            <button onClick={handleLeave} className="btn-ghost w-full text-sm">
              ← Sair da partida
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'setup' && (
        <Link to="/" className="btn-ghost text-sm text-center">
          ← Voltar ao Menu
        </Link>
      )}
    </div>
  );
}
