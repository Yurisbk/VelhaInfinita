"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.activeGameRooms = exports.activeSocketConnections = exports.gamesWonTotal = exports.gamesStartedTotal = exports.httpRequestsTotal = exports.httpRequestDuration = void 0;
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