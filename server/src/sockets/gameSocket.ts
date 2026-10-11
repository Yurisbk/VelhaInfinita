import { Server, Socket } from 'socket.io';
import { GameState, createInitialState, applyMove } from '../utils/gameLogic';
import { GameRecord } from '../models/GameRecord';
import { Player } from '../models/Player';
import { calcElo } from '../utils/elo';
import {
  gamesStartedTotal,
  gamesWonTotal,
  gamesAbandonedTotal,
  rematchesTotal,
  gameDurationSeconds,
  gameMoves,
  matchmakingQueueSize,
  matchmakingWaitSeconds,
  matchmakingTimeoutsTotal,
  eloUpdatesTotal,
  activeGameRooms,
} from '../utils/metrics';

type RoomMode = 'online' | 'quickmatch' | 'ranked';
type QueueName = 'quickmatch' | 'ranked';

interface RoomPlayer {
  socketId: string;
  symbol: 'X' | 'O';
  name: string;
  playerId?: string;
}

interface Room {
  code: string;
  players: RoomPlayer[];
  state: GameState;
  startedAt: number;
  moves: number[];
  rematchVotes: Set<string>;
  rematchTimeout?: ReturnType<typeof setTimeout>;
  mode: RoomMode;
}

const rooms = new Map<string, Room>();

/** Tracks which room a socket currently belongs to */
const socketRoomMap = new Map<string, string>();

interface QueueEntry {
  socketId: string;
  name: string;
  preferredSymbol: 'X' | 'O';
  playerId?: string;
  joinedAt: number;
}

const queues: Record<QueueName, QueueEntry[]> = { quickmatch: [], ranked: [] };

export const QUEUE_TIMEOUT_MS = 60_000;
const REMATCH_TIMEOUT_MS = 30_000;
const PLAYER_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

/** Per-socket queue timeout handles so the matching side can cancel them */
const queueTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function cleanName(name: unknown, fallback: string): string {
  return (typeof name === 'string' ? name.trim().slice(0, 20) : '') || fallback;
}

function cleanSymbol(symbol: unknown): 'X' | 'O' {
  return symbol === 'O' ? 'O' : 'X';
}

function updateQueueGauges(): void {
  for (const q of Object.keys(queues) as QueueName[]) {
    matchmakingQueueSize.set({ queue: q }, queues[q].length);
  }
}

function cancelQueueTimeout(socketId: string): void {
  const t = queueTimeouts.get(socketId);
  if (t) { clearTimeout(t); queueTimeouts.delete(socketId); }
}

/** Removes the socket from every queue. Returns true if it was queued. */
function removeFromQueues(socketId: string): boolean {
  cancelQueueTimeout(socketId);
  let removed = false;
  for (const queue of Object.values(queues)) {
    const idx = queue.findIndex((e) => e.socketId === socketId);
    if (idx !== -1) { queue.splice(idx, 1); removed = true; }
  }
  updateQueueGauges();
  return removed;
}

function isQueued(socketId: string): boolean {
  return Object.values(queues).some((q) => q.some((e) => e.socketId === socketId));
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

function createRoom(code: string, players: RoomPlayer[], mode: RoomMode): Room {
  const room: Room = {
    code,
    players,
    state: createInitialState(),
    startedAt: Date.now(),
    moves: [],
    rematchVotes: new Set(),
    mode,
  };
  rooms.set(code, room);
  activeGameRooms.inc();
  return room;
}

function cleanRoom(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  clearTimeout(room.rematchTimeout);
  rooms.delete(code);
  activeGameRooms.dec();
}

function emitGameStart(io: Server, room: Room): void {
  for (const p of room.players) {
    const opponent = room.players.find((o) => o.socketId !== p.socketId);
    io.to(p.socketId).emit('game_start', { symbol: p.symbol, opponentName: opponent?.name });
  }
  io.to(room.code).emit('game_update', room.state);
}

function recordFinishedGame(io: Server, room: Room, winner: 'X' | 'O', abandoned: boolean): void {
  const { mode } = room;
  const durationSeconds = Math.round((Date.now() - room.startedAt) / 1000);

  gamesWonTotal.inc({ mode, winner });
  if (abandoned) {
    gamesAbandonedTotal.inc({ mode });
  } else {
    gameDurationSeconds.observe({ mode }, durationSeconds);
    gameMoves.observe({ mode }, room.moves.length);
  }

  GameRecord.create({
    mode,
    winner,
    moves: room.moves,
    durationSeconds,
    abandoned,
    players: room.players.map((p) => p.name),
  }).catch(console.error);

  if (mode === 'ranked') {
    updateRankedElo(io, room, winner).catch((err) => {
      eloUpdatesTotal.inc({ status: 'failed' });
      console.error(err);
    });
  }
}

/**
 * A socket leaves its room (explicitly or by disconnecting). If a game was
 * still running, the remaining player wins by abandonment. The room is always
 * closed and both players are detached from it so they can queue again.
 */
function handleLeaveRoom(io: Server, socket: Socket, code: string): void {
  socket.leave(code);
  socketRoomMap.delete(socket.id);

  const room = rooms.get(code);
  if (!room) return;

  const remaining = room.players.find((p) => p.socketId !== socket.id);
  const gameInProgress = room.players.length === 2 && room.state.winner === null;
  const winner = gameInProgress && remaining ? remaining.symbol : null;

  if (remaining) {
    io.to(remaining.socketId).emit('opponent_left', { winner });
    io.sockets.sockets.get(remaining.socketId)?.leave(code);
    socketRoomMap.delete(remaining.socketId);
  }

  if (winner) recordFinishedGame(io, room, winner, true);

  cleanRoom(code);
}

async function updateRankedElo(io: Server, room: Room, winnerSymbol: 'X' | 'O'): Promise<void> {
  const winnerPlayer = room.players.find((p) => p.symbol === winnerSymbol);
  const loserPlayer  = room.players.find((p) => p.symbol !== winnerSymbol);
  if (!winnerPlayer?.playerId || !loserPlayer?.playerId) {
    eloUpdatesTotal.inc({ status: 'skipped' });
    return;
  }

  // Players are created on their first ranked result (and their name refreshed).
  const ensure = (p: RoomPlayer) =>
    Player.findOneAndUpdate(
      { playerId: p.playerId },
      { $set: { name: p.name } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  const [winnerDoc, loserDoc] = await Promise.all([ensure(winnerPlayer), ensure(loserPlayer)]);

  const { winner: newWinnerElo, loser: newLoserElo } = calcElo(winnerDoc.elo, loserDoc.elo);

  await Promise.all([
    Player.updateOne({ playerId: winnerPlayer.playerId }, { $set: { elo: newWinnerElo }, $inc: { rankedWins: 1 } }),
    Player.updateOne({ playerId: loserPlayer.playerId },  { $set: { elo: newLoserElo },  $inc: { rankedLosses: 1 } }),
  ]);
  eloUpdatesTotal.inc({ status: 'applied' });

  io.to(winnerPlayer.socketId).emit('elo_update', { newElo: newWinnerElo, delta: newWinnerElo - winnerDoc.elo });
  io.to(loserPlayer.socketId).emit('elo_update',  { newElo: newLoserElo,  delta: newLoserElo  - loserDoc.elo });
}

function createMatchedRoom(io: Server, opponent: QueueEntry, joiner: QueueEntry, mode: QueueName): void {
  const [symOpponent, symJoiner] = resolveSymbols(opponent.preferredSymbol, joiner.preferredSymbol);

  const code = generateRoomCode();
  const room = createRoom(code, [
    { socketId: opponent.socketId, symbol: symOpponent, name: opponent.name, playerId: opponent.playerId },
    { socketId: joiner.socketId,   symbol: symJoiner,   name: joiner.name,   playerId: joiner.playerId },
  ], mode);

  for (const p of room.players) {
    io.sockets.sockets.get(p.socketId)?.join(code);
    socketRoomMap.set(p.socketId, code);
  }

  gamesStartedTotal.inc({ mode });
  emitGameStart(io, room);
}

function joinQueue(socket: Socket, io: Server, queueName: QueueName, entry: QueueEntry): void {
  if (socketRoomMap.has(socket.id)) {
    socket.emit('error', 'Você já está em uma partida.');
    return;
  }
  if (isQueued(socket.id)) return;

  const queue = queues[queueName];
  // Never match a socket with itself, and never match the same ranked player
  // (e.g. two tabs) against themselves — that would let someone farm ELO.
  const idx = queue.findIndex(
    (e) => e.socketId !== socket.id && !(queueName === 'ranked' && e.playerId === entry.playerId),
  );

  if (idx !== -1) {
    const [opponent] = queue.splice(idx, 1);
    cancelQueueTimeout(opponent.socketId);
    matchmakingWaitSeconds.observe({ queue: queueName }, (Date.now() - opponent.joinedAt) / 1000);
    updateQueueGauges();
    createMatchedRoom(io, opponent, entry, queueName);
    return;
  }

  queue.push(entry);
  updateQueueGauges();
  socket.emit('queue_joined', { position: queue.length });

  const timeout = setTimeout(() => {
    queueTimeouts.delete(socket.id);
    if (removeFromQueues(socket.id)) {
      matchmakingTimeoutsTotal.inc({ queue: queueName });
      socket.emit('queue_timeout');
    }
  }, QUEUE_TIMEOUT_MS);
  queueTimeouts.set(socket.id, timeout);
}

export function registerGameSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {

    socket.on('create_room', ({ name, symbol }: { name?: string; symbol?: 'X' | 'O' } = {}) => {
      if (socketRoomMap.has(socket.id) || isQueued(socket.id)) {
        socket.emit('error', 'Você já está em uma partida.');
        return;
      }
      const code = generateRoomCode();
      createRoom(code, [{ socketId: socket.id, symbol: cleanSymbol(symbol), name: cleanName(name, 'Jogador 1') }], 'online');
      socket.join(code);
      socketRoomMap.set(socket.id, code);
      socket.emit('room_created', code);
    });

    socket.on('join_room', ({ code, name }: { code?: string; name?: string } = {}) => {
      const upperCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
      const room = rooms.get(upperCode);
      if (!room || room.mode !== 'online') { socket.emit('error', 'Sala não encontrada.'); return; }
      if (room.players.some((p) => p.socketId === socket.id)) { socket.emit('error', 'Você já está nesta sala.'); return; }
      if (room.players.length >= 2) { socket.emit('error', 'Sala cheia.'); return; }
      if (socketRoomMap.has(socket.id) || isQueued(socket.id)) {
        socket.emit('error', 'Você já está em uma partida.');
        return;
      }

      const joinerSymbol = room.players[0].symbol === 'X' ? 'O' : 'X';
      room.players.push({ socketId: socket.id, symbol: joinerSymbol, name: cleanName(name, 'Jogador 2') });
      room.startedAt = Date.now();
      socket.join(upperCode);
      socketRoomMap.set(socket.id, upperCode);

      gamesStartedTotal.inc({ mode: 'online' });
      emitGameStart(io, room);
    });

    socket.on('make_move', (index: unknown) => {
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 8) {
        socket.emit('error', 'Movimento inválido.');
        return;
      }
      const currentRoom = socketRoomMap.get(socket.id);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || room.players.length < 2) return;

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
        room.rematchVotes = new Set();
        recordFinishedGame(io, room, newState.winner, false);
      }
    });

    socket.on('request_rematch', () => {
      const currentRoom = socketRoomMap.get(socket.id);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.state.winner || room.players.length < 2) return;
      if (room.rematchVotes.has(socket.id)) return;

      room.rematchVotes.add(socket.id);

      if (room.rematchVotes.size === 1) {
        socket.to(currentRoom).emit('rematch_requested');
        room.rematchTimeout = setTimeout(() => {
          if (rooms.has(currentRoom)) {
            room.rematchVotes.clear();
            io.to(currentRoom).emit('rematch_expired');
          }
        }, REMATCH_TIMEOUT_MS);
        return;
      }

      clearTimeout(room.rematchTimeout);
      // Swap symbols so the player who went second now starts (X always moves first).
      for (const p of room.players) p.symbol = p.symbol === 'X' ? 'O' : 'X';
      room.state = createInitialState();
      room.moves = [];
      room.startedAt = Date.now();
      room.rematchVotes = new Set();

      rematchesTotal.inc({ mode: room.mode });
      gamesStartedTotal.inc({ mode: room.mode });
      emitGameStart(io, room);
    });

    socket.on('join_queue', ({ name, symbol }: { name?: string; symbol?: 'X' | 'O' } = {}) => {
      joinQueue(socket, io, 'quickmatch', {
        socketId: socket.id,
        name: cleanName(name, 'Jogador'),
        preferredSymbol: cleanSymbol(symbol),
        joinedAt: Date.now(),
      });
    });

    socket.on('join_ranked_queue', ({ name, symbol, playerId }: { name?: string; symbol?: 'X' | 'O'; playerId?: string } = {}) => {
      if (typeof playerId !== 'string' || !PLAYER_ID_RE.test(playerId)) {
        socket.emit('error', 'Identificador de jogador inválido. Recarregue a página.');
        return;
      }
      joinQueue(socket, io, 'ranked', {
        socketId: socket.id,
        name: cleanName(name, 'Jogador'),
        preferredSymbol: cleanSymbol(symbol),
        playerId,
        joinedAt: Date.now(),
      });
    });

    socket.on('leave_queue', () => {
      if (removeFromQueues(socket.id)) socket.emit('queue_left');
    });

    socket.on('leave_room', () => {
      const currentRoom = socketRoomMap.get(socket.id);
      if (currentRoom) handleLeaveRoom(io, socket, currentRoom);
    });

    socket.on('disconnect', () => {
      removeFromQueues(socket.id);
      const currentRoom = socketRoomMap.get(socket.id);
      if (currentRoom) handleLeaveRoom(io, socket, currentRoom);
    });
  });
}
