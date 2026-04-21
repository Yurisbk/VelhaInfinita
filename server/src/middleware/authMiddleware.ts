import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: string;
  email: string;
  username: string;
}

const JWT_OPTIONS: jwt.VerifyOptions = {
  algorithms: ['HS256'],
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token não fornecido.' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET ?? 'secret',
      JWT_OPTIONS,
    ) as JwtPayload;
    req.user = { id: payload.id, email: payload.email, username: payload.username };
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET ?? 'secret',
        JWT_OPTIONS,
      ) as JwtPayload;
      req.user = { id: payload.id, email: payload.email, username: payload.username };
    } catch {
      // silently ignore invalid token for optional routes
    }
  }
  next();
}
