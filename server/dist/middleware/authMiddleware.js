"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_OPTIONS = {
    algorithms: ['HS256'],
};
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Token não fornecido.' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET ?? 'secret', JWT_OPTIONS);
        req.user = { id: payload.id, email: payload.email, username: payload.username };
        next();
    }
    catch {
        res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
}
function optionalAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET ?? 'secret', JWT_OPTIONS);
            req.user = { id: payload.id, email: payload.email, username: payload.username };
        }
        catch {
            // silently ignore invalid token for optional routes
        }
    }
    next();
}
//# sourceMappingURL=authMiddleware.js.map