import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, createInitialState } from '../utils/gameLogic';
import { serverOrigin } from '../services/api';

export type MatchPhase = 'idle' | 'searching' | 'waiting' | 'playing' | 'ended';
export type RematchState = 'idle' | 'waiting' | 'opponent_wants';
type Symbol = 'X' | 'O';
/** 'abandoned': left mid-game (you win) · 'left': left after the game ended */
export type OpponentLeft = 'abandoned' | 'left' | null;

export interface EloChange {
  newElo: number;
  delta: number;
}

/**
 * Owns one socket connection for the lifetime of the page that uses it and
 * exposes the online match state machine shared by the online modes
 * (room with a friend, quick match and ranked).
 *
 * The socket is disconnected on unmount, so leaving the page mid-game ends
 * the match on the server (the opponent wins by abandonment) instead of
 * leaving a ghost player in the room.
 */
export function useMatchSocket() {
  const socketRef = useRef<Socket | null>(null);
  const phaseRef = useRef<MatchPhase>('idle');

  const [phase, setPhaseState] = useState<MatchPhase>('idle');
  const [mySymbol, setMySymbol] = useState<Symbol | null>(null);
  const [opponentName, setOpponentName] = useState('');
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [roomCode, setRoomCode] = useState('');
  const [queuePosition, setQueuePosition] = useState(1);
  const [rematchState, setRematchState] = useState<RematchState>('idle');
  const [opponentLeft, setOpponentLeft] = useState<OpponentLeft>(null);
  const [eloChange, setEloChange] = useState<EloChange | null>(null);
  const [error, setError] = useState('');

  const setPhase = useCallback((p: MatchPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const resetMatch = useCallback(() => {
    setPhase('idle');
    setMySymbol(null);
    setOpponentName('');
    setGameState(createInitialState());
    setRoomCode('');
    setRematchState('idle');
    setOpponentLeft(null);
    setEloChange(null);
  }, [setPhase]);

  useEffect(() => {
    const s = io(serverOrigin, { transports: ['websocket', 'polling'] });
    socketRef.current = s;

    s.on('connect', () => setError(''));
    s.on('connect_error', () => setError('Não foi possível conectar ao servidor. Tentando novamente…'));
    s.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return;
      // The server drops rooms and queues of a disconnected socket, so there is
      // nothing to resume — go back to the start of the flow.
      if (phaseRef.current !== 'idle') {
        resetMatch();
        setError('Conexão com o servidor perdida.');
      }
    });

    s.on('room_created', (code: string) => {
      setRoomCode(code);
      setPhase('waiting');
    });
    s.on('queue_joined', ({ position }: { position: number }) => setQueuePosition(position));
    s.on('queue_timeout', () => {
      setError('Tempo esgotado. Nenhum oponente encontrado.');
      setPhase('idle');
    });
    s.on('queue_left', () => setPhase('idle'));

    s.on('game_start', ({ symbol, opponentName: name }: { symbol: Symbol; opponentName?: string }) => {
      setMySymbol(symbol);
      setOpponentName(name ?? '');
      setGameState(createInitialState());
      setRematchState('idle');
      setOpponentLeft(null);
      setEloChange(null);
      setPhase('playing');
    });

    s.on('game_update', (state: GameState) => {
      setGameState(state);
      if (state.winner) setPhase('ended');
    });

    s.on('elo_update', (data: EloChange) => setEloChange(data));

    s.on('opponent_left', ({ winner }: { winner: Symbol | null }) => {
      if (winner) setGameState((prev) => ({ ...prev, winner, fadingCell: null }));
      setOpponentLeft(winner ? 'abandoned' : 'left');
      setRematchState('idle');
      setPhase('ended');
    });

    s.on('rematch_requested', () => setRematchState('opponent_wants'));
    s.on('rematch_expired', () => setRematchState('idle'));

    s.on('error', (msg: string) => {
      setError(msg);
      if (phaseRef.current === 'searching') setPhase('idle');
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, [setPhase, resetMatch]);

  // Server messages like "Não é sua vez." should not stay on screen forever.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const createRoom = useCallback((name: string, symbol: Symbol) => {
    setError('');
    emit('create_room', { name, symbol });
  }, [emit]);

  const joinRoom = useCallback((code: string, name: string) => {
    setError('');
    emit('join_room', { code: code.trim().toUpperCase(), name });
  }, [emit]);

  const search = useCallback(
    (queue: 'quickmatch' | 'ranked', payload: { name: string; symbol: Symbol; playerId?: string }) => {
      setError('');
      setQueuePosition(1);
      setPhase('searching');
      emit(queue === 'ranked' ? 'join_ranked_queue' : 'join_queue', payload);
    },
    [emit, setPhase],
  );

  const cancelSearch = useCallback(() => {
    emit('leave_queue');
    setPhase('idle');
  }, [emit, setPhase]);

  const isMyTurn = phase === 'playing' && mySymbol === gameState.currentPlayer;

  const move = useCallback((index: number) => {
    if (isMyTurn) emit('make_move', index);
  }, [emit, isMyTurn]);

  const requestRematch = useCallback(() => {
    emit('request_rematch');
    setRematchState('waiting');
  }, [emit]);

  /** Leave the current room (or waiting room) and go back to the start */
  const leave = useCallback(() => {
    emit('leave_room');
    resetMatch();
  }, [emit, resetMatch]);

  return {
    phase,
    mySymbol,
    opponentName,
    gameState,
    roomCode,
    queuePosition,
    rematchState,
    opponentLeft,
    eloChange,
    error,
    isMyTurn,
    createRoom,
    joinRoom,
    search,
    cancelSearch,
    move,
    requestRematch,
    leave,
  };
}

export type MatchSocket = ReturnType<typeof useMatchSocket>;
