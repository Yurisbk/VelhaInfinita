import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

function signToken(payload: { id: string; email: string; username: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '7d' });
}

// ─── Google OAuth ────────────────────────────────────────────────────────────

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? `${profile.id}@google.com`;
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.create({
              googleId: profile.id,
              email,
              username: profile.displayName,
            });
          }
          done(null, {
            id: (user._id as unknown as { toString(): string }).toString(),
            email: user.email,
            username: user.username,
          });
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as Express.User));

  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req: Request, res: Response) => {
      const user = req.user as Express.User;
      const token = signToken(user);
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      res.redirect(`${frontendUrl}?token=${token}`);
    },
  );
} else {
  router.get('/google', (_req: Request, res: Response) => {
    res.status(503).json({ message: 'Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env' });
  });
}

// ─── Local Auth ───────────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password } = req.body as {
      email?: string;
      username?: string;
      password?: string;
    };

    if (!email || !username || !password) {
      res.status(400).json({ message: 'Email, nome e senha são obrigatórios.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'A senha deve ter ao menos 6 caracteres.' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ message: 'E-mail já cadastrado.' });
      return;
    }

    const user = await User.create({ email, username, password });
    const token = signToken({
      id: (user._id as unknown as { toString(): string }).toString(),
      email: user.email,
      username: user.username,
    });

    res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ message: 'Email e senha são obrigatórios.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: 'Credenciais inválidas.' });
      return;
    }

    const token = signToken({
      id: (user._id as unknown as { toString(): string }).toString(),
      email: user.email,
      username: user.username,
    });

    res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
