"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const stats_1 = __importDefault(require("./routes/stats"));
const admin_1 = __importDefault(require("./routes/admin"));
const player_1 = __importDefault(require("./routes/player"));
const gameSocket_1 = require("./sockets/gameSocket");
const metricsMiddleware_1 = require("./middleware/metricsMiddleware");
const ipMiddleware_1 = require("./middleware/ipMiddleware");
const metrics_1 = require("./utils/metrics");
exports.app = (0, express_1.default)();
exports.server = http_1.default.createServer(exports.app);
// ─── Socket.io ────────────────────────────────────────────────────────────────
exports.io = new socket_io_1.Server(exports.server, {
    cors: {
        origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 20000,
});
exports.io.on('connection', (socket) => {
    metrics_1.activeSocketConnections.inc();
    socket.on('disconnect', () => metrics_1.activeSocketConnections.dec());
});
(0, gameSocket_1.registerGameSocket)(exports.io);
// ─── Rate Limiters ────────────────────────────────────────────────────────────
const IS_TEST = process.env.NODE_ENV === 'test';
// Behind Render/Vercel the client IP comes in X-Forwarded-For; without this every
// visitor would share the proxy's IP (and a single rate-limit bucket).
exports.app.set('trust proxy', 1);
/** Global: 120 requests per minute per IP */
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: IS_TEST ? 10000 : 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas requisições. Tente novamente em 1 minuto.' },
});
/** Admin: 20 req/min (auto-refresh every 15 s) — also slows down password guessing */
const adminLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: IS_TEST ? 10000 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Limite do painel admin atingido.' },
});
// ─── Express Middleware ───────────────────────────────────────────────────────
exports.app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
}));
exports.app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
}));
exports.app.use(express_1.default.json({ limit: '16kb' }));
exports.app.use(metricsMiddleware_1.metricsMiddleware);
exports.app.use(ipMiddleware_1.ipMiddleware);
// Apply global limiter to all routes
exports.app.use(globalLimiter);
// ─── Routes ───────────────────────────────────────────────────────────────────
exports.app.use('/api/stats', stats_1.default);
exports.app.use('/api/admin', adminLimiter, admin_1.default);
exports.app.use('/api/player', player_1.default);
exports.app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metrics_1.register.contentType);
    res.end(await metrics_1.register.metrics());
});
exports.app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
//# sourceMappingURL=app.js.map