import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

import statsRouter from './routes/stats';
import adminRouter from './routes/admin';
import { registerGameSocket } from './sockets/gameSocket';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { ipMiddleware } from './middleware/ipMiddleware';
import { register, activeSocketConnections } from './utils/metrics';

export const app = express();
export const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
export const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', () => activeSocketConnections.inc());
io.on('disconnect', () => activeSocketConnections.dec());
registerGameSocket(io);

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const IS_TEST = process.env.NODE_ENV === 'test';

/** Global: 10 requests per minute for every route */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_TEST ? 10_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas requisições. Tente novamente em 1 minuto.' },
});

/** Admin dashboard: 20 req/min to support auto-refresh every 15 s */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_TEST ? 10_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Limite do painel admin atingido.' },
});

// ─── Express Middleware ───────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json({ limit: '16kb' }));
app.use(metricsMiddleware);
app.use(ipMiddleware);

// Apply global limiter to all routes
app.use(globalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/stats', statsRouter);
app.use('/api/admin', adminLimiter, adminRouter);

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
