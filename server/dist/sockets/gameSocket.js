"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGameSocket = registerGameSocket;
const gameLogic_1 = require("../utils/gameLogic");
const GameRecord_1 = require("../models/GameRecord");
const metrics_1 = require("../utils/metrics");
const rooms = new Map();
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
function registerGameSocket(io) {
    io.on('connection', (socket) => {
        let currentRoom = null;
        socket.on('create_room', () => {
            const code = generateRoomCode();
            const room = {
                code,
                players: [{ socketId: socket.id, symbol: 'X' }],
                state: (0, gameLogic_1.createInitialState)(),
                startedAt: Date.now(),
                moves: [],
            };
            rooms.set(code, room);
            metrics_1.activeGameRooms.inc();
            socket.join(code);
            currentRoom = code;
            socket.emit('room_created', code);
        });
        socket.on('join_room', (code) => {
            const room = rooms.get(code?.toUpperCase());
            if (!room) {
                socket.emit('error', 'Sala não encontrada.');
                return;
            }
            if (room.players.length >= 2) {
                socket.emit('error', 'Sala cheia.');
                return;
            }
            room.players.push({ socketId: socket.id, symbol: 'O' });
            socket.join(code.toUpperCase());
            currentRoom = code.toUpperCase();
            io.to(room.players[0].socketId).emit('opponent_joined');
            io.to(room.players[0].socketId).emit('game_start', { symbol: 'X' });
            socket.emit('game_start', { symbol: 'O' });
            metrics_1.gamesStartedTotal.inc({ mode: 'online' });
            io.to(currentRoom).emit('game_update', room.state);
        });
        socket.on('make_move', (index) => {
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
                metrics_1.gamesWonTotal.inc({ mode: 'online', winner: newState.winner });
                GameRecord_1.GameRecord.create({
                    mode: 'online',
                    winner: newState.winner,
                    moves: room.moves,
                    durationSeconds,
                }).catch(console.error);
                cleanRoom(currentRoom);
                currentRoom = null;
            }
        });
        socket.on('leave_room', () => {
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (room) {
                const remaining = room.players.find((p) => p.socketId !== socket.id);
                const winner = remaining?.symbol ?? null;
                socket.to(currentRoom).emit('opponent_left', { winner });
                if (winner) {
                    const durationSeconds = Math.round((Date.now() - room.startedAt) / 1000);
                    metrics_1.gamesWonTotal.inc({ mode: 'online', winner });
                    GameRecord_1.GameRecord.create({
                        mode: 'online',
                        winner,
                        moves: room.moves,
                        durationSeconds,
                    }).catch(console.error);
                }
                cleanRoom(currentRoom);
            }
            socket.leave(currentRoom);
            currentRoom = null;
        });
        socket.on('disconnect', () => {
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (room) {
                const remaining = room.players.find((p) => p.socketId !== socket.id);
                const winner = remaining?.symbol ?? null;
                socket.to(currentRoom).emit('opponent_left', { winner });
                if (winner) {
                    const durationSeconds = Math.round((Date.now() - room.startedAt) / 1000);
                    metrics_1.gamesWonTotal.inc({ mode: 'online', winner });
                    GameRecord_1.GameRecord.create({
                        mode: 'online',
                        winner,
                        moves: room.moves,
                        durationSeconds,
                    }).catch(console.error);
                }
                cleanRoom(currentRoom);
            }
        });
    });
}
//# sourceMappingURL=gameSocket.js.map