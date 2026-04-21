import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

import authRouter from './routes/auth';
import statsRouter from './routes/stats';
import adminRouter from './routes/admin';
import { registerGameSocket } from './sockets/gameSocket';
import { metricsMiddleware } from './middleware/metricsMiddleware';
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
app.use(express.json());
app.use(passport.initialize());
app.use(metricsMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/stats', statsRouter);
app.use('/api/admin', adminRouter);

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
