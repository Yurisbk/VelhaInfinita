import { Server, Socket } from 'socket.io';
import { GameState, createInitialState, applyMove } from '../utils/gameLogic';
import { GameRecord } from '../models/GameRecord';
import { Player } from '../models/Player';
import { calcElo } from '../utils/elo';
import {
  gamesStartedTotal,
  gamesWonTotal,
  activeGameRooms,
} from '../utils/metrics';

interface Room {
  code: string;
  players: { socketId: string; symbol: 'X' | 'O'; name: string; playerId?: string }[];
  state: GameState;
  startedAt: number;
  moves: number[];
  rematchVotes: Set<string>;
  rematchTimeout?: ReturnType<typeof setTimeout>;
  ranked: boolean;
}

const rooms = new Map<string, Room>();

/** Tracks which room a socket currently belongs to */
const socketRoomMap = new Map<string, string>();

interface QueueEntry {
  socketId: string;
  name: string;
  preferredSymbol: 'X' | 'O';
  playerId?: string;
}

const matchmakingQueue: QueueEntry[] = [];
const rankedQueue: QueueEntry[] = [];

/** Per-socket queue timeout handles so the matching side can cancel them */
const queueTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function removeFromQueue(queue: QueueEntry[], socketId: string): void {
  const idx = queue.findIndex((e) => e.socketId === socketId);
  if (idx !== -1) queue.splice(idx, 1);
}

function cancelQueueTimeout(socketId: string): void {
  const t = queueTimeouts.get(socketId);
  if (t) { clearTimeout(t); queueTimeouts.delete(socketId); }
}

/** Resolve symbols: respect preference, randomly break tie */
function resolveSymbols(
  sym1: 'X' | 'O',
  sym2: 'X' | 'O',
): ['X' | 'O', 'X' | 'O'] {
  if (sym1 !== sym2) return [sym1, sym2];
  return Math.random() < 0.5 ? [sym1, sym2 === 'X' ? 'O' : 'X'] : [sym1 === 'X' ? 'O' : 'X', sym2];
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
    const mode = room.ranked ? 'ranked' : 'online';
    gamesWonTotal.inc({ mode, winner });
    GameRecord.create({ mode, winner, moves: room.moves, durationSeconds }).catch(console.error);

    if (room.ranked) {
      updateRankedElo(io, room, winner).catch(console.error);
    }
  }

  cleanRoom(code);
}

async function updateRankedElo(io: Server, room: Room, winnerSymbol: string): Promise<void> {
  const winnerPlayer = room.players.find((p) => p.symbol === winnerSymbol);
  const loserPlayer  = room.players.find((p) => p.symbol !== winnerSymbol);
  if (!winnerPlayer?.playerId || !loserPlayer?.playerId) return;

  const [winnerDoc, loserDoc] = await Promise.all([
    Player.findOne({ playerId: winnerPlayer.playerId }),
    Player.findOne({ playerId: loserPlayer.playerId }),
  ]);
  if (!winnerDoc || !loserDoc) return;

  const { winner: newWinnerElo, loser: newLoserElo } = calcElo(winnerDoc.elo, loserDoc.elo);

  await Promise.all([
    Player.updateOne({ playerId: winnerPlayer.playerId }, { elo: newWinnerElo, $inc: { rankedWins: 1 } }),
    Player.updateOne({ playerId: loserPlayer.playerId },  { elo: newLoserElo,  $inc: { rankedLosses: 1 } }),
  ]);

  io.to(winnerPlayer.socketId).emit('elo_update', { newElo: newWinnerElo, delta: newWinnerElo - winnerDoc.elo });
  io.to(loserPlayer.socketId).emit('elo_update',  { newElo: newLoserElo,  delta: newLoserElo  - loserDoc.elo });
}

function createMatchedRoom(
  io: Server,
  opponent: QueueEntry,
  joiner: QueueEntry,
  ranked: boolean,
): void {
  const [symOpponent, symJoiner] = resolveSymbols(opponent.preferredSymbol, joiner.preferredSymbol);

  const code = generateRoomCode();
  const room: Room = {
    code,
    players: [
      { socketId: opponent.socketId, symbol: symOpponent, name: opponent.name, playerId: opponent.playerId },
      { socketId: joiner.socketId,   symbol: symJoiner,   name: joiner.name,   playerId: joiner.playerId },
    ],
    state: createInitialState(),
    startedAt: Date.now(),
    moves: [],
    rematchVotes: new Set(),
    ranked,
  };
  rooms.set(code, room);
  activeGameRooms.inc();

  const opponentSocket = io.sockets.sockets.get(opponent.socketId);
  if (opponentSocket) {
    opponentSocket.join(code);
    socketRoomMap.set(opponent.socketId, code);
  }

  const joinerSocket = io.sockets.sockets.get(joiner.socketId);
  if (joinerSocket) {
    joinerSocket.join(code);
    socketRoomMap.set(joiner.socketId, code);
  }

  const mode = ranked ? 'ranked' : 'quickmatch';
  gamesStartedTotal.inc({ mode });

  io.to(opponent.socketId).emit('game_start', { symbol: symOpponent, opponentName: joiner.name });
  io.to(joiner.socketId).emit('game_start',   { symbol: symJoiner,   opponentName: opponent.name });
  io.to(code).emit('game_update', room.state);
}

function joinQueue(
  socket: Socket,
  io: Server,
  queue: QueueEntry[],
  entry: QueueEntry,
  ranked: boolean,
): void {
  const currentRoom = socketRoomMap.get(socket.id);
  if (entry.socketId && currentRoom) return;

  if (queue.length > 0) {
    const opponent = queue.shift()!;
    cancelQueueTimeout(opponent.socketId);
    createMatchedRoom(io, opponent, entry, ranked);
  } else {
    queue.push(entry);
    socket.emit('queue_joined', { position: queue.length });

    const timeout = setTimeout(() => {
      if (!socketRoomMap.has(socket.id)) {
        removeFromQueue(queue, socket.id);
        queueTimeouts.delete(socket.id);
        socket.emit('queue_timeout');
      }
    }, 60000);
    queueTimeouts.set(socket.id, timeout);

    socket.once('leave_queue', () => {
      cancelQueueTimeout(socket.id);
      removeFromQueue(queue, socket.id);
      socket.emit('queue_left');
    });
  }
}

export function registerGameSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {

    socket.on('create_room', ({ name }: { name?: string } = {}) => {
      const code = generateRoomCode();
      const room: Room = {
        code,
        players: [{ socketId: socket.id, symbol: 'X', name: name?.trim() || 'Jogador 1' }],
        state: createInitialState(),
        startedAt: Date.now(),
        moves: [],
        rematchVotes: new Set(),
        ranked: false,
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
      if (!room) { socket.emit('error', 'Sala não encontrada.'); return; }
      if (room.players.length >= 2) { socket.emit('error', 'Sala cheia.'); return; }

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
        const mode = room.ranked ? 'ranked' : 'online';
        gamesWonTotal.inc({ mode, winner: newState.winner });
        GameRecord.create({ mode, winner: newState.winner, moves: room.moves, durationSeconds }).catch(console.error);

        if (room.ranked) {
          updateRankedElo(io, room, newState.winner).catch(console.error);
        }

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
        gamesStartedTotal.inc({ mode: room.ranked ? 'ranked' : 'online' });
        io.to(currentRoom).emit('game_update', room.state);
      }
    });

    socket.on('join_queue', ({ name, symbol }: { name?: string; symbol?: 'X' | 'O' } = {}) => {
      joinQueue(socket, io, matchmakingQueue, {
        socketId: socket.id,
        name: name?.trim() || 'Jogador',
        preferredSymbol: symbol ?? 'X',
      }, false);
    });

    socket.on('join_ranked_queue', ({ name, symbol, playerId }: { name?: string; symbol?: 'X' | 'O'; playerId?: string } = {}) => {
      joinQueue(socket, io, rankedQueue, {
        socketId: socket.id,
        name: name?.trim() || 'Jogador',
        preferredSymbol: symbol ?? 'X',
        playerId,
      }, true);
    });

    socket.on('leave_room', () => {
      const currentRoom = socketRoomMap.get(socket.id);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) handleLeaveRoom(io, socket, currentRoom, !!room.state.winner);
      socket.leave(currentRoom);
      socketRoomMap.delete(socket.id);
    });

    socket.on('disconnect', () => {
      cancelQueueTimeout(socket.id);
      removeFromQueue(matchmakingQueue, socket.id);
      removeFromQueue(rankedQueue, socket.id);

      const currentRoom = socketRoomMap.get(socket.id);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) handleLeaveRoom(io, socket, currentRoom, !!room.state.winner);
      socketRoomMap.delete(socket.id);
    });
  });
}
