const API_ORIGIN = import.meta.env.VITE_API_URL ?? '';
const BASE = `${API_ORIGIN}/api`;

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  const data: unknown = await res.json();

  if (!res.ok) {
    const err = data as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

interface AuthPayload {
  token: string;
  user: { id: string; email: string; username: string };
}

export const api = {
  register(email: string, username: string, password: string): Promise<AuthPayload> {
    return request<AuthPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
  },

  login(email: string, password: string): Promise<AuthPayload> {
    return request<AuthPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  getStats(token?: string | null): Promise<unknown> {
    return request<unknown>('/stats', {}, token);
  },
};

/** URL base do servidor (sem /api) — usado para OAuth e sockets */
export const serverOrigin = API_ORIGIN;
