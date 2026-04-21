import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import Board from '../components/Board';
import GameStatus from '../components/GameStatus';
import { GameState, createInitialState } from '../utils/gameLogic';

type Phase = 'lobby' | 'waiting' | 'playing' | 'ended';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    const serverUrl = import.meta.env.VITE_API_URL ?? '';
    socket = io(serverUrl, { transports: ['websocket', 'polling'] });
  }
  return socket;
}

export default function OnlineGame() {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [mySymbol, setMySymbol] = useState<'X' | 'O' | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const s = getSocket();

    s.on('room_created', (code: string) => {
      setRoomCode(code);
      setPhase('waiting');
      setStatusMsg(`Sala criada! Código: ${code}`);
    });

    s.on('opponent_joined', () => {
      setStatusMsg('Oponente entrou! Começando…');
    });

    s.on('game_start', ({ symbol }: { symbol: 'X' | 'O' }) => {
      setMySymbol(symbol);
      setPhase('playing');
      setStatusMsg('');
    });

    s.on('game_update', (state: GameState) => {
      setGameState(state);
      if (state.winner) setPhase('ended');
    });

    s.on('opponent_left', () => {
      setStatusMsg('Oponente saiu da sala.');
      setPhase('ended');
    });

    s.on('error', (msg: string) => {
      setError(msg);
    });

    return () => {
      s.off('room_created');
      s.off('opponent_joined');
      s.off('game_start');
      s.off('game_update');
      s.off('opponent_left');
      s.off('error');
    };
  }, []);

  const handleCreateRoom = useCallback(() => {
    setError('');
    getSocket().emit('create_room');
  }, []);

  const handleJoinRoom = useCallback(() => {
    if (!inputCode.trim()) return;
    setError('');
    getSocket().emit('join_room', inputCode.trim().toUpperCase());
  }, [inputCode]);

  const handleMove = useCallback(
    (index: number) => {
      if (mySymbol !== gameState.currentPlayer) return;
      getSocket().emit('make_move', index);
    },
    [mySymbol, gameState.currentPlayer],
  );

  const handleReset = useCallback(() => {
    socket?.disconnect();
    socket = null;
    setPhase('lobby');
    setRoomCode('');
    setInputCode('');
    setMySymbol(null);
    setGameState(createInitialState());
    setStatusMsg('');
    setError('');
  }, []);

  const isMyTurn = mySymbol === gameState.currentPlayer;

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 gap-6">
      <motion.h1
        className="text-2xl font-black"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🌐 Modo Online
      </motion.h1>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {phase === 'lobby' && (
        <motion.div
          className="card w-full max-w-sm flex flex-col gap-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <button onClick={handleCreateRoom} className="btn-primary w-full">
            Criar Sala
          </button>

          <div className="flex flex-col gap-2">
            <input
              type="text"
              className="input uppercase tracking-widest text-center font-bold"
              placeholder="CÓDIGO DA SALA"
              maxLength={4}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <button
              onClick={handleJoinRoom}
              className="btn-secondary w-full"
              disabled={inputCode.length < 4}
            >
              Entrar na Sala
            </button>
          </div>

          <Link to="/" className="btn-ghost w-full text-center text-sm">
            ← Voltar
          </Link>
        </motion.div>
      )}

      {phase === 'waiting' && (
        <motion.div
          className="card w-full max-w-sm text-center space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-white/60">Aguardando oponente…</p>
          <div className="bg-primary/20 rounded-2xl py-6 px-4">
            <p className="text-xs text-white/40 mb-2">Código da sala</p>
            <p className="text-5xl font-black tracking-widest text-primary">{roomCode}</p>
          </div>
          <p className="text-sm text-white/40">Compartilhe o código com seu amigo</p>
          <button onClick={handleReset} className="btn-ghost text-sm">
            Cancelar
          </button>
        </motion.div>
      )}

      {(phase === 'playing' || phase === 'ended') && (
        <motion.div
          className="card w-full max-w-sm space-y-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-center">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${isMyTurn ? 'bg-primary/30 text-primary' : 'bg-white/10 text-white/40'}`}>
              Você é o {mySymbol} {isMyTurn && phase === 'playing' ? '— sua vez!' : ''}
            </span>
          </div>

          {statusMsg && <p className="text-center text-white/60 text-sm">{statusMsg}</p>}

          <GameStatus
            state={gameState}
            playerLabel={{
              X: mySymbol === 'X' ? 'Você (X)' : 'Oponente (X)',
              O: mySymbol === 'O' ? 'Você (O)' : 'Oponente (O)',
            }}
            onReset={handleReset}
          />
          <Board
            state={gameState}
            onMove={handleMove}
            disabled={!isMyTurn || phase === 'ended'}
          />

          <button onClick={handleReset} className="btn-ghost w-full text-sm">
            ← Sair da partida
          </button>
        </motion.div>
      )}
    </div>
  );
}
