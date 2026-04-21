import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import express from 'express';
import mongoose from 'mongoose';
import { app, server } from './app';

// ─── Static frontend (production, monolith only) ──────────────────────────────
// Only active when the client build exists alongside the server (monolith deploy).
// On Render + Vercel (separate deploys) this folder won't exist and is skipped.
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

// ─── MongoDB + Start ──────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
const MONGO_URI =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017/tictactoe-infinite';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch((err) => {
    console.warn(
      '⚠️  MongoDB não conectado – persistência desativada:',
      (err as Error).message,
    );
  });

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Métricas em http://localhost:${PORT}/metrics`);
});
