import { Server, Socket } from 'socket.io';
import { GameState, createInitialState, applyMove } from '../utils/gameLogic';
import { GameRecord } from '../models/GameRecord';
import {
  gamesStartedTotal,
  gamesWonTotal,
  activeGameRooms,
} from '../utils/metrics';

interface Room {
  code: string;
  players: { socketId: string; symbol: 'X' | 'O'; name: string }[];
  state: GameState;
  startedAt: number;
  moves: number[];
  rematchVotes: Set<string>;
  rematchTimeout?: ReturnType<typeof setTimeout>;
}

const rooms = new Map<string, Room>();

/** Tracks which room a socket currently belongs to (works across quickmatch matching) */
const socketRoomMap = new Map<string, string>();

interface QueueEntry {
  socketId: string;
  name: string;
}

const matchmakingQueue: QueueEntry[] = [];

function removeFromQueue(socketId: string): void {
  const idx = matchmakingQueue.findIndex((e) => e.socketId === socketId);
  if (idx !== -1) matchmakingQueue.splice(idx, 1);
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function cleanRoom(code: string): void {
  rooms.delete(code);
  activeGameRooms.dec();
}

function handleLeaveRoom(io: Server, socket: Socket, code: string, isWin: boolean): void {
  const room = rooms.get(code);
  if (!room) return;
  clearTimeout(room.rematchTimeout);
  const remaining = room.players.find((p) => p.socketId !== socket.id);
  const winner = remaining?.symbol ?? null;
  socket.to(code).emit('opponent_left', { winner });

  if (winner && !isWin) {
    const durationSeconds = Math.round((Date.now() - room.startedAt) / 1000);
    gamesWonTotal.inc({ mode: 'online', winner });
    GameRecord.create({
      mode: 'online',
      winner,
      moves: room.moves,
      durationSeconds,
    }).catch(console.error);
  }

  cleanRoom(code);
}

export function registerGameSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {
    let inQueue = false;

    socket.on('create_room', ({ name }: { name?: string } = {}) => {
      const code = generateRoomCode();
      const room: Room = {
        code,
        players: [{ socketId: socket.id, symbol: 'X', name: name?.trim() || 'Jogador 1' }],
        state: createInitialState(),
        startedAt: Date.now(),
        moves: [],
        rematchVotes: new Set(),
      };
      rooms.set(code, room);
      activeGameRooms.inc();
      socket.join(code);
      socketRoomMap.set(socket.id, code);
      socket.emit('room_created', code);
    });

    socket.on('join_room', ({ code, name }: { code: string; name?: string }) => {
      const upperCode = code?.toUpperCase();
      const room = rooms.get(upperCode);
      if (!room) {
        socket.emit('error', 'Sala não encontrada.');
        return;
      }
      if (room.players.length >= 2) {
        socket.emit('error', 'Sala cheia.');
        return;
      }

      const joinerName = name?.trim() || 'Jogador 2';
      room.players.push({ socketId: socket.id, symbol: 'O', name: joinerName });
      socket.join(upperCode);
      socketRoomMap.set(socket.id, upperCode);

      io.to(room.players[0].socketId).emit('opponent_joined', { opponentName: joinerName });
      io.to(room.players[0].socketId).emit('game_start', { symbol: 'X', opponentName: joinerName });
      socket.emit('game_start', { symbol: 'O', opponentName: room.players[0].name });

      gamesStartedTotal.inc({ mode: 'online' });
      io.to(upperCode).emit('game_update', room.state);
    });

    socket.on('make_move', (index: number) => {
      const currentRoom = socketRoomMap.get(socket.id);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return;
      if (room.state.currentPlayer !== player.symbol) {
        socket.emit('error', 'Não é sua vez.');
        return;
      }

      const newState = applyMove(room.state, index);
      if (newState === room.state) {
        socket.emit('error', 'Movimento inválido.');
        return;
      }

      room.state = newState;
      room.moves.push(index);
      io.to(currentRoom).emit('game_update', newState);

      if (newState.winner) {
        const durationSeconds = Math.round((Date.now() - room.startedAt) / 1000);
        gamesWonTotal.inc({ mode: 'online', winner: newState.winner });

        GameRecord.create({
          mode: 'online',
          winner: newState.winner,
          moves: room.moves,
          durationSeconds,
        }).catch(console.error);

        room.rematchVotes = new Set();
      }
    });

    socket.on('request_rematch', () => {
      const currentRoom = socketRoomMap.get(socket.id);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.state.winner) return;

      room.rematchVotes.add(socket.id);

      if (room.rematchVotes.size === 1) {
        socket.to(currentRoom).emit('rematch_requested');
        room.rematchTimeout = setTimeout(() => {
          if (rooms.has(currentRoom)) {
            room.rematchVotes.clear();
            io.to(currentRoom).emit('rematch_expired');
          }
        }, 30000);
        return;
      }

      if (room.rematchVotes.size >= 2) {
        clearTimeout(room.rematchTimeout);
        room.state = createInitialState();
        room.moves = [];
        room.startedAt = Date.now();
        room.rematchVotes = new Set();

        for (const p of room.players) {
          const opponent = room.players.find((o) => o.socketId !== p.socketId);
          io.to(p.socketId).emit('game_start', { symbol: p.symbol, opponentName: opponent?.name });
        }
        gamesStartedTotal.inc({ mode: 'online' });
        io.to(currentRoom).emit('game_update', room.state);
      }
    });

    socket.on('join_queue', ({ name }: { name?: string } = {}) => {
      const currentRoom = socketRoomMap.get(socket.id);
      if (inQueue || currentRoom) return;

      const playerName = name?.trim() || 'Jogador';
      inQueue = true;

      if (matchmakingQueue.length > 0) {
        const opponent = matchmakingQueue.shift()!;
        inQueue = false;

        const code = generateRoomCode();
        const room: Room = {
          code,
          players: [
            { socketId: opponent.socketId, symbol: 'X', name: opponent.name },
            { socketId: socket.id, symbol: 'O', name: playerName },
          ],
          state: createInitialState(),
          startedAt: Date.now(),
          moves: [],
          rematchVotes: new Set(),
        };
        rooms.set(code, room);
        activeGameRooms.inc();

        const opponentSocket = io.sockets.sockets.get(opponent.socketId);
        if (opponentSocket) {
          opponentSocket.join(code);
          socketRoomMap.set(opponent.socketId, code);
        }
        socket.join(code);
        socketRoomMap.set(socket.id, code);

        io.to(opponent.socketId).emit('game_start', { symbol: 'X', opponentName: playerName });
        socket.emit('game_start', { symbol: 'O', opponentName: opponent.name });
        gamesStartedTotal.inc({ mode: 'quickmatch' });
        io.to(code).emit('game_update', room.state);
      } else {
        matchmakingQueue.push({ socketId: socket.id, name: playerName });
        socket.emit('queue_joined', { position: matchmakingQueue.length });

        const timeout = setTimeout(() => {
          if (inQueue) {
            removeFromQueue(socket.id);
            inQueue = false;
            socket.emit('queue_timeout');
          }
        }, 60000);

        socket.once('leave_queue', () => {
          clearTimeout(timeout);
          removeFromQueue(socket.id);
          inQueue = false;
          socket.emit('queue_left');
        });
      }
    });

    socket.on('leave_room', () => {
      const currentRoom = socketRoomMap.get(socket.id);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) {
        handleLeaveRoom(io, socket, currentRoom, !!room.state.winner);
      }
      socket.leave(currentRoom);
      socketRoomMap.delete(socket.id);
    });

    socket.on('disconnect', () => {
      if (inQueue) {
        removeFromQueue(socket.id);
        inQueue = false;
      }
      const currentRoom = socketRoomMap.get(socket.id);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) {
        handleLeaveRoom(io, socket, currentRoom, !!room.state.winner);
      }
      socketRoomMap.delete(socket.id);
    });
  });
}
