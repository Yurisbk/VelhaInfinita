"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
// ─── Static frontend (production, monolith only) ──────────────────────────────
// Only active when the client build exists alongside the server (monolith deploy).
// On Render + Vercel (separate deploys) this folder won't exist and is skipped.
if (process.env.NODE_ENV === 'production') {
    const clientDist = path_1.default.join(__dirname, '../../client/dist');
    if (fs_1.default.existsSync(clientDist)) {
        app_1.app.use(express_1.default.static(clientDist));
        app_1.app.get('*', (_req, res) => {
            res.sendFile(path_1.default.join(clientDist, 'index.html'));
        });
    }
}
// ─── MongoDB + Start ──────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/tictactoe-infinite';
mongoose_1.default
    .connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch((err) => {
    console.warn('⚠️  MongoDB não conectado – persistência desativada:', err.message);
});
app_1.server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Métricas em http://localhost:${PORT}/metrics`);
});
//# sourceMappingURL=index.js.map