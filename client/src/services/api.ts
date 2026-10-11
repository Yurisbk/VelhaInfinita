const API_ORIGIN = import.meta.env.VITE_API_URL ?? '';
const BASE = `${API_ORIGIN}/api`;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  const data: unknown = await res.json();

  if (!res.ok) {
    const err = data as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export interface PlayerStats {
  name: string;
  elo: number;
  rankedWins: number;
  rankedLosses: number;
  rank?: number;
}

export interface GameReport {
  mode: 'local' | 'cpu';
  winner: 'X' | 'O';
  moves: number[];
  durationSeconds: number;
  difficulty?: string;
  humanSymbol?: 'X' | 'O';
}

export const api = {
  getStats(): Promise<unknown> {
    return request<unknown>('/stats');
  },
  /** Resolves null when the player has never played a ranked game */
  getPlayer(playerId: string): Promise<PlayerStats | null> {
    return request<PlayerStats>(`/player/${encodeURIComponent(playerId)}`).catch(() => null);
  },
  getLeaderboard(): Promise<PlayerStats[]> {
    return request<PlayerStats[]>('/player/leaderboard');
  },
  /** Fire-and-forget: local/CPU results only feed the metrics */
  reportGame(report: GameReport): void {
    request('/stats/game', { method: 'POST', body: JSON.stringify(report) }).catch(() => {});
  },
};

/** URL base do servidor (sem /api) — usado para sockets */
export const serverOrigin = API_ORIGIN;
