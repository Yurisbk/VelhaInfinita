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
// ─── Helpers ──────────────────────────────────────────────────────────────────
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET ?? 'secret', {
        expiresIn: '7d',
        algorithm: 'HS256',
    });
}
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-ZÀ-ÖØ-öø-ÿ0-9 _.-]{2,30}$/;
function validateRegisterInput(email, username, password) {
    if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
        return 'Email, nome e senha são obrigatórios.';
    }
    const e = email.trim();
    const u = username.trim();
    const p = password;
    if (!e || !u || !p) {
        return 'Email, nome e senha são obrigatórios.';
    }
    if (!EMAIL_REGEX.test(e)) {
        return 'Formato de e-mail inválido.';
    }
    if (!USERNAME_REGEX.test(u)) {
        return 'Nome deve ter entre 2 e 30 caracteres e não conter símbolos especiais.';
    }
    if (p.length < 8) {
        return 'A senha deve ter ao menos 8 caracteres.';
    }
    return null;
}
// ─── Google OAuth ─────────────────────────────────────────────────────────────
const frontendUrl = () => process.env.FRONTEND_URL ?? 'http://localhost:5173';
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
    router.get('/google/callback', (req, res, next) => {
        passport_1.default.authenticate('google', {
            session: false,
            failureRedirect: `${frontendUrl()}/login?error=oauth`,
        })(req, res, next);
    }, (req, res) => {
        const user = req.user;
        const token = signToken(user);
        res.redirect(`${frontendUrl()}?token=${token}`);
    });
}
else {
    router.get('/google', (_req, res) => {
        res.status(503).json({
            message: 'Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env',
        });
    });
}
// ─── Local Auth ───────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const validationError = validateRegisterInput(email, username, password);
        if (validationError) {
            res.status(400).json({ message: validationError });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const cleanUsername = username.trim();
        const existing = await User_1.User.findOne({ email: cleanEmail });
        if (existing) {
            res.status(409).json({ message: 'E-mail já cadastrado.' });
            return;
        }
        const user = await User_1.User.create({
            email: cleanEmail,
            username: cleanUsername,
            password: password,
        });
        const token = signToken({
            id: user._id.toString(),
            email: user.email,
            username: user.username,
        });
        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, username: user.username },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
            res.status(400).json({ message: 'Email e senha são obrigatórios.' });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const user = await User_1.User.findOne({ email: cleanEmail }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            // generic message prevents user enumeration
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