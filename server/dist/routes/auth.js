"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const User_1 = require("../models/User");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '7d' });
}
// ─── Google OAuth ────────────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '/api/auth/google/callback',
    }, async (_accessToken, _refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value ?? `${profile.id}@google.com`;
            let user = await User_1.User.findOne({ googleId: profile.id });
            if (!user) {
                user = await User_1.User.create({
                    googleId: profile.id,
                    email,
                    username: profile.displayName,
                });
            }
            done(null, {
                id: user._id.toString(),
                email: user.email,
                username: user.username,
            });
        }
        catch (err) {
            done(err);
        }
    }));
    passport_1.default.serializeUser((user, done) => done(null, user));
    passport_1.default.deserializeUser((user, done) => done(null, user));
    router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'], session: false }));
    router.get('/google/callback', passport_1.default.authenticate('google', { session: false, failureRedirect: '/login' }), (req, res) => {
        const user = req.user;
        const token = signToken(user);
        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
        res.redirect(`${frontendUrl}?token=${token}`);
    });
}
else {
    router.get('/google', (_req, res) => {
        res.status(503).json({ message: 'Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env' });
    });
}
// ─── Local Auth ───────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        if (!email || !username || !password) {
            res.status(400).json({ message: 'Email, nome e senha são obrigatórios.' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ message: 'A senha deve ter ao menos 6 caracteres.' });
            return;
        }
        const existing = await User_1.User.findOne({ email: email.toLowerCase() });
        if (existing) {
            res.status(409).json({ message: 'E-mail já cadastrado.' });
            return;
        }
        const user = await User_1.User.create({ email, username, password });
        const token = signToken({
            id: user._id.toString(),
            email: user.email,
            username: user.username,
        });
        res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username } });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: 'Email e senha são obrigatórios.' });
            return;
        }
        const user = await User_1.User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            res.status(401).json({ message: 'Credenciais inválidas.' });
            return;
        }
        const token = signToken({
            id: user._id.toString(),
            email: user.email,
            username: user.username,
        });
        res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
router.get('/me', authMiddleware_1.requireAuth, (req, res) => {
    res.json({ user: req.user });
});
exports.default = router;
//# sourceMappingURL=auth.js.map