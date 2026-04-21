import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';

export interface AccessEntry {
  ip: string;
  anonymizedIp: string;
  country: string | null;
  city: string | null;
  region: string | null;
  timestamp: string;
  route: string;
  method: string;
}

const MAX_ENTRIES = 500;
const accessLog: AccessEntry[] = [];

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function anonymizeIp(ip: string): string {
  if (ip.includes(':')) {
    // IPv6 — keep first 4 groups
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + ':****';
  }
  // IPv4 — zero last octet
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  return ip;
}

export function ipMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const rawIp = extractIp(req);
  const geo = geoip.lookup(rawIp);

  const entry: AccessEntry = {
    ip: rawIp,
    anonymizedIp: anonymizeIp(rawIp),
    country: geo?.country ?? null,
    city: geo?.city ?? null,
    region: geo?.region ?? null,
    timestamp: new Date().toISOString(),
    route: req.path,
    method: req.method,
  };

  if (accessLog.length >= MAX_ENTRIES) {
    accessLog.shift();
  }
  accessLog.push(entry);

  next();
}

export function getRecentAccesses(limit = 100): AccessEntry[] {
  return accessLog.slice(-limit).reverse();
}
