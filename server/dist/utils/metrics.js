"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.activeGameRooms = exports.activeSocketConnections = exports.eloUpdatesTotal = exports.matchmakingTimeoutsTotal = exports.matchmakingWaitSeconds = exports.matchmakingQueueSize = exports.cpuGamesTotal = exports.gameMoves = exports.gameDurationSeconds = exports.rematchesTotal = exports.gamesAbandonedTotal = exports.gamesWonTotal = exports.gamesStartedTotal = exports.httpRequestsTotal = exports.httpRequestDuration = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
const register = new prom_client_1.default.Registry();
exports.register = register;
prom_client_1.default.collectDefaultMetrics({ register });
exports.httpRequestDuration = new prom_client_1.default.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register],
});
exports.httpRequestsTotal = new prom_client_1.default.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});
exports.gamesStartedTotal = new prom_client_1.default.Counter({
    name: 'games_started_total',
    help: 'Total number of games started',
    labelNames: ['mode'],
    registers: [register],
});
exports.gamesWonTotal = new prom_client_1.default.Counter({
    name: 'games_won_total',
    help: 'Total number of games won',
    labelNames: ['mode', 'winner'],
    registers: [register],
});
exports.gamesAbandonedTotal = new prom_client_1.default.Counter({
    name: 'games_abandoned_total',
    help: 'Games ended because a player left before a winner was decided',
    labelNames: ['mode'],
    registers: [register],
});
exports.rematchesTotal = new prom_client_1.default.Counter({
    name: 'rematches_total',
    help: 'Rematches accepted by both players',
    labelNames: ['mode'],
    registers: [register],
});
exports.gameDurationSeconds = new prom_client_1.default.Histogram({
    name: 'game_duration_seconds',
    help: 'Duration of finished games in seconds',
    labelNames: ['mode'],
    buckets: [10, 30, 60, 120, 300, 600, 1200],
    registers: [register],
});
exports.gameMoves = new prom_client_1.default.Histogram({
    name: 'game_moves',
    help: 'Number of moves in finished games',
    labelNames: ['mode'],
    buckets: [5, 7, 9, 12, 15, 20, 30, 50],
    registers: [register],
});
exports.cpuGamesTotal = new prom_client_1.default.Counter({
    name: 'cpu_games_total',
    help: 'Finished games against the CPU by difficulty and who won',
    labelNames: ['difficulty', 'result'],
    registers: [register],
});
exports.matchmakingQueueSize = new prom_client_1.default.Gauge({
    name: 'matchmaking_queue_size',
    help: 'Players currently waiting in a matchmaking queue',
    labelNames: ['queue'],
    registers: [register],
});
exports.matchmakingWaitSeconds = new prom_client_1.default.Histogram({
    name: 'matchmaking_wait_seconds',
    help: 'Time a player waited in queue before being matched',
    labelNames: ['queue'],
    buckets: [1, 3, 5, 10, 20, 30, 45, 60],
    registers: [register],
});
exports.matchmakingTimeoutsTotal = new prom_client_1.default.Counter({
    name: 'matchmaking_timeouts_total',
    help: 'Queue searches that ended without an opponent',
    labelNames: ['queue'],
    registers: [register],
});
exports.eloUpdatesTotal = new prom_client_1.default.Counter({
    name: 'elo_updates_total',
    help: 'Ranked results applied to player ELO',
    labelNames: ['status'],
    registers: [register],
});
exports.activeSocketConnections = new prom_client_1.default.Gauge({
    name: 'socket_connections_active',
    help: 'Number of currently active socket connections',
    registers: [register],
});
exports.activeGameRooms = new prom_client_1.default.Gauge({
    name: 'game_rooms_active',
    help: 'Number of active game rooms',
    registers: [register],
});
//# sourceMappingURL=metrics.js.map