import { useState, useEffect, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PrometheusData {
  activeConnections: number;
  activeRooms: number;
  gamesStarted: Record<string, number>;
  gamesWon: Record<string, number>;
  gamesWonByWinner: Record<string, number>;
  httpRequests: Record<string, number>;
  totalHttpRequests: number;
}

interface MongoData {
  totalGames: number;
  byMode: { _id: string; count: number }[];
  recentGames: { mode: string; winner: string; durationSeconds: number; createdAt: string }[];
}

interface DashboardData {
  prometheus: PrometheusData;
  mongo: MongoData;
}

const SESSION_KEY = 'ttt_admin_pw';

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-white/40 text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-white/30 text-xs">{sub}</p>}
    </div>
  );
}

function BarChart({ data, colorClass = 'bg-primary' }: { data: Record<string, number>; colorClass?: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-white/50 text-xs w-20 shrink-0 capitalize">{label}</span>
          <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${colorClass}`}
              initial={{ width: 0 }}
              animate={{ width: `${(value / max) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="text-white font-bold text-sm w-10 text-right">{value}</span>
        </div>
      ))}
      {entries.length === 0 && <p className="text-white/20 text-sm">Nenhum dado ainda</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      setAuthed(true);
      setPassword(saved);
    }
  }, []);

  const fetchData = useCallback(async (pw: string) => {
    const apiOrigin = import.meta.env.VITE_API_URL ?? '';
    setLoading(true);
    try {
      const res = await fetch(`${apiOrigin}/api/admin/dashboard`, {
        headers: { 'x-admin-password': pw },
      });
      if (!res.ok) {
        setAuthed(false);
        sessionStorage.removeItem(SESSION_KEY);
        setError('Sessão expirada. Faça login novamente.');
        return;
      }
      const json = (await res.json()) as DashboardData;
      setData(json);
      setLastRefresh(new Date());
    } catch {
      setError('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed && password) {
      fetchData(password);
      const interval = setInterval(() => fetchData(password), 15_000);
      return () => clearInterval(interval);
    }
  }, [authed, password, fetchData]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    const apiOrigin = import.meta.env.VITE_API_URL ?? '';
    const res = await fetch(`${apiOrigin}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      sessionStorage.setItem(SESSION_KEY, password);
      setAuthed(true);
    } else {
      setError('Senha incorreta.');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setPassword('');
    setData(null);
  }

  if (!authed) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-4">
        <motion.div
          className="card w-full max-w-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-xl font-black mb-1">🔒 Admin</h1>
          <p className="text-white/40 text-sm mb-6">Acesso restrito ao painel de métricas</p>

          {error && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-2 mb-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              className="input"
              placeholder="Senha de admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary w-full">
              Entrar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const p = data?.prometheus;
  const m = data?.mongo;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">📊 Painel Admin</h1>
          {lastRefresh && (
            <p className="text-white/30 text-xs mt-1">
              Atualizado às {lastRefresh.toLocaleTimeString('pt-BR')} · auto-refresh a cada 15s
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchData(password)}
            className="btn-ghost text-sm px-4 py-2"
            disabled={loading}
          >
            {loading ? '↻' : '↺'} Atualizar
          </button>
          <button onClick={handleLogout} className="btn-ghost text-sm px-4 py-2">
            Sair
          </button>
        </div>
      </div>

      <AnimatePresence>
        {loading && !data && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-white/40 text-sm text-center py-12"
          >
            Carregando métricas…
          </motion.p>
        )}
      </AnimatePresence>

      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          {/* ── Tempo Real ──────────────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-3">
              Tempo Real (Prometheus)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Conexões ativas" value={p?.activeConnections ?? 0} color="text-cyan-300" />
              <StatCard label="Salas abertas" value={p?.activeRooms ?? 0} color="text-pink-300" />
              <StatCard label="Partidas iniciadas" value={Object.values(p?.gamesStarted ?? {}).reduce((a, b) => a + b, 0)} />
              <StatCard
                label="Total req HTTP"
                value={p?.totalHttpRequests ?? 0}
                sub="todas as rotas"
              />
            </div>
          </section>

          {/* ── Partidas por modo ─────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-3">
              Partidas Iniciadas por Modo
            </h2>
            <div className="card">
              <BarChart data={p?.gamesStarted ?? {}} colorClass="bg-primary" />
            </div>
          </section>

          {/* ── Vitórias ─────────────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 gap-4">
            <section>
              <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-3">
                Vitórias por Modo
              </h2>
              <div className="card">
                <BarChart data={p?.gamesWon ?? {}} colorClass="bg-secondary" />
              </div>
            </section>
            <section>
              <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-3">
                Vitórias por Símbolo
              </h2>
              <div className="card">
                <BarChart
                  data={p?.gamesWonByWinner ?? {}}
                  colorClass="bg-yellow-500"
                />
              </div>
            </section>
          </div>

          {/* ── MongoDB ───────────────────────────────────────────── */}
          {m && (
            <section>
              <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-3">
                MongoDB — Partidas Salvas
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <StatCard label="Total salvas" value={m.totalGames} color="text-green-400" />
                {m.byMode.map((b) => (
                  <StatCard key={b._id} label={`Modo ${b._id}`} value={b.count} />
                ))}
              </div>

              {m.recentGames.length > 0 && (
                <div className="card overflow-x-auto">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-3">
                    Últimas 5 partidas
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/30 text-xs border-b border-white/10">
                        <th className="text-left pb-2">Modo</th>
                        <th className="text-left pb-2">Vencedor</th>
                        <th className="text-left pb-2">Duração</th>
                        <th className="text-left pb-2">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {m.recentGames.map((g, i) => (
                        <tr key={i}>
                          <td className="py-2 capitalize">{g.mode}</td>
                          <td className={`py-2 font-bold ${g.winner === 'X' ? 'text-cyan-300' : g.winner === 'O' ? 'text-pink-300' : 'text-white/40'}`}>
                            {g.winner === 'none' ? '—' : g.winner}
                          </td>
                          <td className="py-2 text-white/60">{g.durationSeconds}s</td>
                          <td className="py-2 text-white/40 text-xs">
                            {new Date(g.createdAt).toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ── HTTP requests por rota ────────────────────────────── */}
          <section>
            <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-3">
              Requisições HTTP por Rota
            </h2>
            <div className="card">
              <BarChart
                data={Object.fromEntries(
                  Object.entries(p?.httpRequests ?? {}).slice(0, 10),
                )}
                colorClass="bg-violet-500"
              />
            </div>
          </section>
        </motion.div>
      )}
    </div>
  );
}
