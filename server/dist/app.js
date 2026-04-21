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
const passport_1 = __importDefault(require("passport"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const auth_1 = __importDefault(require("./routes/auth"));
const stats_1 = __importDefault(require("./routes/stats"));
const admin_1 = __importDefault(require("./routes/admin"));
const gameSocket_1 = require("./sockets/gameSocket");
const metricsMiddleware_1 = require("./middleware/metricsMiddleware");
const metrics_1 = require("./utils/metrics");
exports.app = (0, express_1.default)();
exports.server = http_1.default.createServer(exports.app);
// ─── Socket.io ────────────────────────────────────────────────────────────────
exports.io = new socket_io_1.Server(exports.server, {
    cors: {
        origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
});
exports.io.on('connection', () => metrics_1.activeSocketConnections.inc());
exports.io.on('disconnect', () => metrics_1.activeSocketConnections.dec());
(0, gameSocket_1.registerGameSocket)(exports.io);
// ─── Express Middleware ───────────────────────────────────────────────────────
exports.app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
}));
exports.app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
}));
exports.app.use(express_1.default.json());
exports.app.use(passport_1.default.initialize());
exports.app.use(metricsMiddleware_1.metricsMiddleware);
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});
exports.app.use('/api', limiter);
// ─── Routes ───────────────────────────────────────────────────────────────────
exports.app.use('/api/auth', auth_1.default);
exports.app.use('/api/stats', stats_1.default);
exports.app.use('/api/admin', admin_1.default);
exports.app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metrics_1.register.contentType);
    res.end(await metrics_1.register.metrics());
});
exports.app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
//# sourceMappingURL=app.js.map