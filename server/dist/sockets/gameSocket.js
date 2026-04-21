"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGameSocket = registerGameSocket;
const gameLogic_1 = require("../utils/gameLogic");
const GameRecord_1 = require("../models/GameRecord");
const Player_1 = require("../models/Player");
const elo_1 = require("../utils/elo");
const metrics_1 = require("../utils/metrics");
const rooms = new Map();
/** Tracks which room a socket currently belongs to */
const socketRoomMap = new Map();
const matchmakingQueue = [];
const rankedQueue = [];
/** Per-socket queue timeout handles so the matching side can cancel them */
const queueTimeouts = new Map();
function removeFromQueue(queue, socketId) {
    const idx = queue.findIndex((e) => e.socketId === socketId);
    if (idx !== -1)
        queue.splice(idx, 1);
}
function cancelQueueTimeout(socketId) {
    const t = queueTimeouts.get(socketId);
    if (t) {
        clearTimeout(t);
        queueTimeouts.delete(socketId);
    }
}
/** Resolve symbols: respect preference, randomly break tie */
function resolveSymbols(sym1, sym2) {
    if (sym1 !== sym2)
        return [sym1, sym2];
    return Math.random() < 0.5 ? [sym1, sym2 === 'X' ? 'O' : 'X'] : [sym1 === 'X' ? 'O' : 'X', sym2];
}
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return rooms.has(code) ? generateRoomCode() : code;
}
function cleanRoom(code) {
    rooms.delete(code);
    metrics_1.activeGameRooms.dec();
}
function handleLeaveRoom(io, socket, code, isWin) {
    const room = rooms.get(code);
    if (!room)
        return;
    clearTimeout(room.rematchTimeout);
    const remaining = room.players.find((p) => p.socketId !== socket.id);
    const winner = remaining?.symbol ?? null;
    socket.to(code).emit('opponent_left', { winner });
    if (winner && !isWin) {
        const durationSeconds = Math.round((Date.now() - room.startedAt) / 1000);
        const mode = room.ranked ? 'ranked' : 'online';
        metrics_1.gamesWonTotal.inc({ mode, winner });
        GameRecord_1.GameRecord.create({ mode, winner, moves: room.moves, durationSeconds }).catch(console.error);
        if (room.ranked) {
            updateRankedElo(io, room, winner).catch(console.error);
        }
    }
    cleanRoom(code);
}
async function updateRankedElo(io, room, winnerSymbol) {
    const winnerPlayer = room.players.find((p) => p.symbol === winnerSymbol);
    const loserPlayer = room.players.find((p) => p.symbol !== winnerSymbol);
    if (!winnerPlayer?.playerId || !loserPlayer?.playerId)
        return;
    const [winnerDoc, loserDoc] = await Promise.all([
        Player_1.Player.findOne({ playerId: winnerPlayer.playerId }),
        Player_1.Player.findOne({ playerId: loserPlayer.playerId }),
    ]);
    if (!winnerDoc || !loserDoc)
        return;
    const { winner: newWinnerElo, loser: newLoserElo } = (0, elo_1.calcElo)(winnerDoc.elo, loserDoc.elo);
    await Promise.all([
        Player_1.Player.updateOne({ playerId: winnerPlayer.playerId }, { elo: newWinnerElo, $inc: { rankedWins: 1 } }),
        Player_1.Player.updateOne({ playerId: loserPlayer.playerId }, { elo: newLoserElo, $inc: { rankedLosses: 1 } }),
    ]);
    io.to(winnerPlayer.socketId).emit('elo_update', { newElo: newWinnerElo, delta: newWinnerElo - winnerDoc.elo });
    io.to(loserPlayer.socketId).emit('elo_update', { newElo: newLoserElo, delta: newLoserElo - loserDoc.elo });
}
function createMatchedRoom(io, opponent, joiner, ranked) {
    const [symOpponent, symJoiner] = resolveSymbols(opponent.preferredSymbol, joiner.preferredSymbol);
    const code = generateRoomCode();
    const room = {
        code,
        players: [
            { socketId: opponent.socketId, symbol: symOpponent, name: opponent.name, playerId: opponent.playerId },
            { socketId: joiner.socketId, symbol: symJoiner, name: joiner.name, playerId: joiner.playerId },
        ],
        state: (0, gameLogic_1.createInitialState)(),
        startedAt: Date.now(),
        moves: [],
        rematchVotes: new Set(),
        ranked,
    };
    rooms.set(code, room);
    metrics_1.activeGameRooms.inc();
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
    metrics_1.gamesStartedTotal.inc({ mode });
    io.to(opponent.socketId).emit('game_start', { symbol: symOpponent, opponentName: joiner.name });
    io.to(joiner.socketId).emit('game_start', { symbol: symJoiner, opponentName: opponent.name });
    io.to(code).emit('game_update', room.state);
}
function joinQueue(socket, io, queue, entry, ranked) {
    const currentRoom = socketRoomMap.get(socket.id);
    if (entry.socketId && currentRoom)
        return;
    if (queue.length > 0) {
        const opponent = queue.shift();
        cancelQueueTimeout(opponent.socketId);
        createMatchedRoom(io, opponent, entry, ranked);
    }
    else {
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
function registerGameSocket(io) {
    io.on('connection', (socket) => {
        socket.on('create_room', ({ name } = {}) => {
            const code = generateRoomCode();
            const room = {
                code,
                players: [{ socketId: socket.id, symbol: 'X', name: name?.trim() || 'Jogador 1' }],
                state: (0, gameLogic_1.createInitialState)(),
                startedAt: Date.now(),
                moves: [],
                rematchVotes: new Set(),
                ranked: false,
            };
            rooms.set(code, room);
            metrics_1.activeGameRooms.inc();
            socket.join(code);
            socketRoomMap.set(socket.id, code);
            socket.emit('room_created', code);
        });
        socket.on('join_room', ({ code, name }) => {
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
            metrics_1.gamesStartedTotal.inc({ mode: 'online' });
            io.to(upperCode).emit('game_update', room.state);
        });
        socket.on('make_move', (index) => {
            const currentRoom = socketRoomMap.get(socket.id);
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (!room)
                return;
            const player = room.players.find((p) => p.socketId === socket.id);
            if (!player)
                return;
            if (room.state.currentPlayer !== player.symbol) {
                socket.emit('error', 'Não é sua vez.');
                return;
            }
            const newState = (0, gameLogic_1.applyMove)(room.state, index);
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
                metrics_1.gamesWonTotal.inc({ mode, winner: newState.winner });
                GameRecord_1.GameRecord.create({ mode, winner: newState.winner, moves: room.moves, durationSeconds }).catch(console.error);
                if (room.ranked) {
                    updateRankedElo(io, room, newState.winner).catch(console.error);
                }
                room.rematchVotes = new Set();
            }
        });
        socket.on('request_rematch', () => {
            const currentRoom = socketRoomMap.get(socket.id);
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (!room || !room.state.winner)
                return;
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
                room.state = (0, gameLogic_1.createInitialState)();
                room.moves = [];
                room.startedAt = Date.now();
                room.rematchVotes = new Set();
                for (const p of room.players) {
                    const opponent = room.players.find((o) => o.socketId !== p.socketId);
                    io.to(p.socketId).emit('game_start', { symbol: p.symbol, opponentName: opponent?.name });
                }
                metrics_1.gamesStartedTotal.inc({ mode: room.ranked ? 'ranked' : 'online' });
                io.to(currentRoom).emit('game_update', room.state);
            }
        });
        socket.on('join_queue', ({ name, symbol } = {}) => {
            joinQueue(socket, io, matchmakingQueue, {
                socketId: socket.id,
                name: name?.trim() || 'Jogador',
                preferredSymbol: symbol ?? 'X',
            }, false);
        });
        socket.on('join_ranked_queue', ({ name, symbol, playerId } = {}) => {
            joinQueue(socket, io, rankedQueue, {
                socketId: socket.id,
                name: name?.trim() || 'Jogador',
                preferredSymbol: symbol ?? 'X',
                playerId,
            }, true);
        });
        socket.on('leave_room', () => {
            const currentRoom = socketRoomMap.get(socket.id);
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (room)
                handleLeaveRoom(io, socket, currentRoom, !!room.state.winner);
            socket.leave(currentRoom);
            socketRoomMap.delete(socket.id);
        });
        socket.on('disconnect', () => {
            cancelQueueTimeout(socket.id);
            removeFromQueue(matchmakingQueue, socket.id);
            removeFromQueue(rankedQueue, socket.id);
            const currentRoom = socketRoomMap.get(socket.id);
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (room)
                handleLeaveRoom(io, socket, currentRoom, !!room.state.winner);
            socketRoomMap.delete(socket.id);
        });
    });
}
//# sourceMappingURL=gameSocket.js.map