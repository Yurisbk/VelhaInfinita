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

export const api = {
  getStats(): Promise<unknown> {
    return request<unknown>('/stats');
  },
};

/** URL base do servidor (sem /api) — usado para sockets */
export const serverOrigin = API_ORIGIN;
