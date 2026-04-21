import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signToken(payload: { id: string; email: string; username: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-ZÀ-ÖØ-öø-ÿ0-9 _.-]{2,30}$/;

function validateRegisterInput(
  email: unknown,
  username: unknown,
  password: unknown,
): string | null {
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

const frontendUrl = (): string =>
  process.env.FRONTEND_URL ?? 'http://localhost:5173';

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
    (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate('google', {
        session: false,
        failureRedirect: `${frontendUrl()}/login?error=oauth`,
      })(req, res, next);
    },
    (req: Request, res: Response) => {
      const user = req.user as Express.User;
      const token = signToken(user);
      res.redirect(`${frontendUrl()}?token=${token}`);
    },
  );
} else {
  router.get('/google', (_req: Request, res: Response) => {
    res.status(503).json({
      message: 'Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env',
    });
  });
}

// ─── Local Auth ───────────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password } = req.body as Record<string, unknown>;

    const validationError = validateRegisterInput(email, username, password);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const cleanEmail = (email as string).trim().toLowerCase();
    const cleanUsername = (username as string).trim();

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      res.status(409).json({ message: 'E-mail já cadastrado.' });
      return;
    }

    const user = await User.create({
      email: cleanEmail,
      username: cleanUsername,
      password: password as string,
    });
    const token = signToken({
      id: (user._id as unknown as { toString(): string }).toString(),
      email: user.email,
      username: user.username,
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as Record<string, unknown>;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      res.status(400).json({ message: 'Email e senha são obrigatórios.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      // generic message prevents user enumeration
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
