import { useState, useEffect, useCallback, FormEvent, ReactNode } from 'react';
import { motion } from 'framer-motion';

type Avg = Record<string, { avg: number; count: number }>;

interface PrometheusData {
  uptimeSeconds: number;
  activeConnections: number;
  activeRooms: number;
  queueSizes: Record<string, number>;
  gamesStarted: Record<string, number>;
  gamesWon: Record<string, number>;
  gamesWonByWinner: Record<string, number>;
  gamesAbandoned: Record<string, number>;
  rematches: Record<string, number>;
  avgDuration: Avg;
  avgMoves: Avg;
  matchmakingWait: Avg;
  matchmakingTimeouts: Record<string, number>;
  cpuByDifficulty: Record<string, { human: number; cpu: number }>;
  eloUpdates: Record<string, number>;
  httpRequests: Record<string, number>;
  totalHttpRequests: number;
  httpErrors: number;
}

interface RecentGame {
  mode: string;
  winner: string;
  durationSeconds: number;
  moveCount: number;
  abandoned?: boolean;
  difficulty?: string;
  players?: string[];
  createdAt: string;
}

interface LeaderRow {
  name: string;
  elo: number;
  rankedWins: number;
  rankedLosses: number;
}

interface MongoData {
  totalGames: number;
  gamesLast24h: number;
  byMode: { _id: string; count: number; avgDuration: number; abandoned: number }[];
  cpuByDifficulty: { _id: string; total: number; humanWins: number }[];
  gamesPerDay: { _id: string; count: number }[];
  recentGames: RecentGame[];
  rankedPlayers: number;
  avgElo: number | null;
  leaderboard: LeaderRow[];
}

interface AccessEntry {
  anonymizedIp: string;
  country: string | null;
  city: string | null;
  region: string | null;
  timestamp: string;
  route: string;
  method: string;
}

interface DashboardData {
  prometheus: PrometheusData;
  mongo: MongoData | null;
  recentAccesses: AccessEntry[];
}

const SESSION_KEY = 'ttt_admin_pw';
const REFRESH_MS = 15_000;

const MODE_LABEL: Record<string, string> = {
  local: 'Local',
  cpu: 'vs CPU',
  online: 'Online amigo',
  quickmatch: 'Partida rápida',
  ranked: 'Ranqueado',
};
const DIFF_ORDER = ['easy', 'medium', 'hard', 'insane'];
const DIFF_LABEL: Record<string, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil', insane: 'Insano' };
const QUEUE_LABEL: Record<string, string> = { quickmatch: 'Partida rápida', ranked: 'Ranqueado' };

const modeLabel = (m: string) => MODE_LABEL[m] ?? m;
const sum = (r: Record<string, number> = {}) => Object.values(r).reduce((a, b) => a + b, 0);
const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—');

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m}min ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-sm font-bold text-white/50 uppercase tracking-widest">{title}</h2>
        {hint && <p className="text-white/30 text-xs">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card flex flex-col gap-1 min-w-0">
      <p className="text-white/50 text-xs uppercase tracking-wider truncate">{label}</p>
      <p className="text-3xl font-black tabular-nums truncate">{value}</p>
      {sub && <p className="text-white/40 text-xs">{sub}</p>}
    </div>
  );
}

/**
 * Horizontal bars for one measure (magnitude) — a single hue for every bar;
 * the label and value stay in text colors. Hover shows the exact value.
 */
function BarChart({
  data,
  format = (v) => String(v),
  labelFor = (k) => k,
  barClass = 'bg-indigo-400',
  labelWidth = 'w-28',
  limit,
  showZero = false,
}: {
  data: Record<string, number>;
  format?: (v: number) => string;
  labelFor?: (key: string) => string;
  barClass?: string | ((key: string) => string);
  labelWidth?: string;
  limit?: number;
  /** Keep 0-valued rows (e.g. a 0% win rate is meaningful) */
  showZero?: boolean;
}) {
  const entries = Object.entries(data)
    .filter(([, v]) => showZero || v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  if (entries.length === 0) return <p className="text-white/30 text-sm">Nenhum dado ainda</p>;
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="group flex items-center gap-3" title={`${labelFor(key)}: ${format(value)}`}>
          <span className={`text-white/60 text-xs ${labelWidth} shrink-0 truncate`}>{labelFor(key)}</span>
          <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
            <motion.div
              className={`h-full rounded-r group-hover:brightness-125 ${typeof barClass === 'function' ? barClass(key) : barClass}`}
              initial={{ width: 0 }}
              animate={{ width: `${(value / max) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-white font-semibold text-sm w-14 text-right tabular-nums shrink-0">{format(value)}</span>
        </div>
      ))}
    </div>
  );
}

function Table({
  head,
  rows,
  empty = 'Nenhum dado ainda',
  leftCols = 1,
}: {
  head: string[];
  rows: ReactNode[][];
  empty?: string;
  /** How many leading columns are text (left-aligned); the rest are numbers */
  leftCols?: number;
}) {
  if (rows.length === 0) return <p className="text-white/30 text-sm">{empty}</p>;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/40 text-xs border-b border-white/10">
            {head.map((h, i) => (
              <th key={h} className={`pb-2 px-2 font-medium whitespace-nowrap ${i < leftCols ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((c, i) => (
                <td key={i} className={`py-2 px-2 whitespace-nowrap ${i < leftCols ? 'text-left' : 'text-right tabular-nums text-white/70'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboard() {
  const [password, setPassword] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) ?? ''; } catch { return ''; }
  });
  const [authed, setAuthed] = useState(() => password !== '');
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (pw: string) => {
    const apiOrigin = import.meta.env.VITE_API_URL ?? '';
    setLoading(true);
    try {
      const res = await fetch(`${apiOrigin}/api/admin/dashboard`, {
        headers: { 'x-admin-password': pw },
      });
      if (res.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem(SESSION_KEY);
        setError('Sessão expirada. Faça login novamente.');
        return;
      }
      if (!res.ok) {
        setError(res.status === 429 ? 'Limite de requisições atingido — aguarde um minuto.' : 'Erro ao carregar dados.');
        return;
      }
      setData((await res.json()) as DashboardData);
      setLastRefresh(new Date());
      setError('');
    } catch {
      setError('Servidor indisponível.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed || !password) return;
    fetchData(password);
    const interval = setInterval(() => fetchData(password), REFRESH_MS);
    return () => clearInterval(interval);
    // password only changes while logged out; re-running on every keystroke is not wanted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, fetchData]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    const apiOrigin = import.meta.env.VITE_API_URL ?? '';
    try {
      const res = await fetch(`${apiOrigin}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, password);
        setAuthed(true);
      } else {
        setError(res.status === 429 ? 'Muitas tentativas. Aguarde um minuto.' : 'Senha incorreta.');
      }
    } catch {
      setError('Servidor indisponível.');
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
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          className="card w-full max-w-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-xl font-black mb-1">🔒 Admin</h1>
          <p className="text-white/50 text-sm mb-6">Acesso restrito ao painel de métricas</p>

          {error && (
            <div role="alert" className="bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-2 mb-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              className="input"
              placeholder="Senha de admin"
              aria-label="Senha de admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary w-full" disabled={!password}>
              Entrar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const p = data?.prometheus;
  const m = data?.mongo;

  const startedTotal = sum(p?.gamesStarted);
  const finishedTotal = sum(p?.gamesWon);
  const abandonedTotal = sum(p?.gamesAbandoned);
  const queued = sum(p?.queueSizes);

  // CPU win rate: prefer persisted data (survives restarts), fall back to in-memory counters.
  const cpuRows = DIFF_ORDER.map((d) => {
    const fromDb = m?.cpuByDifficulty.find((c) => c._id === d);
    const fromProm = p?.cpuByDifficulty[d];
    const total = fromDb ? fromDb.total : (fromProm ? fromProm.human + fromProm.cpu : 0);
    const human = fromDb ? fromDb.humanWins : fromProm?.human ?? 0;
    return { d, total, human };
  }).filter((r) => r.total > 0);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">📊 Painel Admin</h1>
          <p className="text-white/40 text-xs mt-1">
            {lastRefresh
              ? `Atualizado às ${lastRefresh.toLocaleTimeString('pt-BR')} · atualiza a cada 15s`
              : 'Carregando…'}
            {p && ` · servidor no ar há ${formatDuration(p.uptimeSeconds)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchData(password)} className="btn-ghost text-sm px-4 py-2" disabled={loading}>
            {loading ? 'Atualizando…' : '↺ Atualizar'}
          </button>
          <button onClick={handleLogout} className="btn-ghost text-sm px-4 py-2">
            Sair
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-2 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!data && loading && <p className="text-white/40 text-sm text-center py-12">Carregando métricas…</p>}

      {data && p && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
          {/* ── Agora ─────────────────────────────────────────────── */}
          <Section title="Agora">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Conexões ativas" value={p.activeConnections} sub="sockets abertos" />
              <StatCard label="Salas abertas" value={p.activeRooms} sub="partidas online + salas esperando" />
              <StatCard
                label="Na fila"
                value={queued}
                sub={`rápida ${p.queueSizes.quickmatch ?? 0} · ranqueada ${p.queueSizes.ranked ?? 0}`}
              />
              <StatCard label="Partidas (24h)" value={m ? m.gamesLast24h : '—'} sub={m ? 'salvas no banco' : 'MongoDB offline'} />
            </div>
          </Section>

          {/* ── Partidas desde o restart ───────────────────────────── */}
          <Section title="Partidas" hint="contadores em memória — zeram quando o servidor reinicia">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Iniciadas" value={startedTotal} />
              <StatCard label="Finalizadas" value={finishedTotal} sub={`${pct(finishedTotal, startedTotal)} das iniciadas`} />
              <StatCard label="Abandonadas" value={abandonedTotal} sub={`${pct(abandonedTotal, finishedTotal)} das finalizadas`} />
              <StatCard label="Revanches" value={sum(p.rematches)} />
            </div>

            <div className="grid md:grid-cols-2 gap-4 [&>*]:min-w-0">
              <div className="card space-y-3">
                <p className="text-white/70 text-sm font-semibold">Iniciadas por modo</p>
                <BarChart data={p.gamesStarted} labelFor={modeLabel} />
              </div>
              <div className="card space-y-3">
                <p className="text-white/70 text-sm font-semibold">Quem vence: X (começa) vs O</p>
                <BarChart
                  data={p.gamesWonByWinner}
                  labelFor={(k) => `Vitórias de ${k}`}
                  barClass={(k) => (k === 'X' ? 'bg-cyan-300' : 'bg-pink-300')}
                  format={(v) => `${v} · ${pct(v, finishedTotal)}`}
                  labelWidth="w-24"
                />
                <p className="text-white/40 text-xs">Se X vence muito mais, quem começa tem vantagem.</p>
              </div>
            </div>

            <div className="card">
              <p className="text-white/70 text-sm font-semibold mb-3">Por modo</p>
              <Table
                head={['Modo', 'Finalizadas', 'Abandono', 'Duração média', 'Jogadas média', 'Revanches']}
                rows={Object.keys({ ...p.gamesStarted, ...p.gamesWon })
                  .sort((a, b) => (p.gamesWon[b] ?? 0) - (p.gamesWon[a] ?? 0))
                  .map((mode) => [
                    modeLabel(mode),
                    p.gamesWon[mode] ?? 0,
                    pct(p.gamesAbandoned[mode] ?? 0, p.gamesWon[mode] ?? 0),
                    p.avgDuration[mode] ? formatDuration(p.avgDuration[mode].avg) : '—',
                    p.avgMoves[mode]?.avg ?? '—',
                    p.rematches[mode] ?? 0,
                  ])}
              />
            </div>
          </Section>

          {/* ── Matchmaking ───────────────────────────────────────── */}
          <Section title="Matchmaking">
            <div className="card">
              <Table
                head={['Fila', 'Na fila agora', 'Pareados', 'Espera média', 'Sem oponente (timeout)']}
                rows={['quickmatch', 'ranked'].map((q) => {
                  const matched = p.matchmakingWait[q]?.count ?? 0;
                  const timeouts = p.matchmakingTimeouts[q] ?? 0;
                  return [
                    QUEUE_LABEL[q],
                    p.queueSizes[q] ?? 0,
                    matched,
                    p.matchmakingWait[q] ? formatDuration(p.matchmakingWait[q].avg) : '—',
                    `${timeouts} (${pct(timeouts, matched + timeouts)})`,
                  ];
                })}
              />
              <p className="text-white/40 text-xs mt-3">
                Muitos timeouts = pouca gente online ao mesmo tempo. Considere sugerir “vs CPU” enquanto o jogador espera.
              </p>
            </div>
          </Section>

          {/* ── CPU ───────────────────────────────────────────────── */}
          <Section title="vs CPU — taxa de vitória do jogador" hint={m ? 'histórico salvo no banco' : 'desde o restart'}>
            <div className="card">
              <BarChart
                data={Object.fromEntries(cpuRows.map((r) => [r.d, r.total ? (r.human / r.total) * 100 : 0]))}
                labelFor={(d) => {
                  const r = cpuRows.find((x) => x.d === d);
                  return `${DIFF_LABEL[d] ?? d} (${r?.total ?? 0})`;
                }}
                format={(v) => `${Math.round(v)}%`}
                showZero
              />
              {cpuRows.length > 0 && cpuRows.every((r) => r.human === 0) && (
                <p className="text-white/40 text-xs mt-3">Ninguém venceu a CPU ainda.</p>
              )}
              <p className="text-white/40 text-xs mt-3">
                Ideal: a taxa cai a cada nível. Se “Fácil” fica abaixo de ~60%, a CPU está difícil demais para iniciantes.
              </p>
            </div>
          </Section>

          {/* ── Ranking ───────────────────────────────────────────── */}
          <Section title="Ranking">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Jogadores ranqueados" value={m ? m.rankedPlayers : '—'} />
              <StatCard label="ELO médio" value={m?.avgElo ?? '—'} sub="começa em 1000" />
              <StatCard label="Resultados aplicados" value={p.eloUpdates.applied ?? 0} sub="desde o restart" />
              <StatCard
                label="Falhas de ELO"
                value={(p.eloUpdates.failed ?? 0) + (p.eloUpdates.skipped ?? 0)}
                sub={`erro ${p.eloUpdates.failed ?? 0} · sem id ${p.eloUpdates.skipped ?? 0}`}
              />
            </div>
            {m && (
              <div className="card">
                <p className="text-white/70 text-sm font-semibold mb-3">Top 10</p>
                <Table
                  head={['#', 'Jogador', 'ELO', 'V', 'D', 'Aproveitamento']}
                  leftCols={2}
                  empty="Ninguém jogou ranqueada ainda."
                  rows={m.leaderboard.map((pl, i) => [
                    i + 1,
                    <span key="n" className="font-semibold text-white">{pl.name}</span>,
                    pl.elo,
                    pl.rankedWins,
                    pl.rankedLosses,
                    pct(pl.rankedWins, pl.rankedWins + pl.rankedLosses),
                  ])}
                />
              </div>
            )}
          </Section>

          {/* ── Banco ─────────────────────────────────────────────── */}
          {m ? (
            <Section title="Histórico (MongoDB)" hint={`${m.totalGames} partidas salvas`}>
              <div className="grid md:grid-cols-2 gap-4 [&>*]:min-w-0">
                <div className="card space-y-3">
                  <p className="text-white/70 text-sm font-semibold">Partidas por dia (7 dias)</p>
                  <BarChart
                    data={Object.fromEntries(m.gamesPerDay.map((d) => [d._id, d.count]))}
                    labelFor={(d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  />
                </div>
                <div className="card">
                  <p className="text-white/70 text-sm font-semibold mb-3">Por modo (histórico)</p>
                  <Table
                    head={['Modo', 'Partidas', 'Duração média', 'Abandono']}
                    rows={m.byMode.map((b) => [
                      modeLabel(b._id),
                      b.count,
                      formatDuration(b.avgDuration),
                      pct(b.abandoned, b.count),
                    ])}
                  />
                </div>
              </div>

              <div className="card">
                <p className="text-white/70 text-sm font-semibold mb-3">Últimas 10 partidas</p>
                <Table
                  head={['Modo', 'Vencedor', 'Jogadas', 'Duração', 'Data']}
                  rows={m.recentGames.map((g) => [
                    <span key="m">
                      {modeLabel(g.mode)}
                      {g.difficulty && <span className="text-white/40"> · {DIFF_LABEL[g.difficulty] ?? g.difficulty}</span>}
                      {g.abandoned && <span className="text-orange-300"> · abandono</span>}
                    </span>,
                    g.winner === 'none' ? '—' : g.winner,
                    g.moveCount,
                    formatDuration(g.durationSeconds),
                    new Date(g.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
                  ])}
                />
              </div>
            </Section>
          ) : (
            <p className="card text-white/50 text-sm">MongoDB offline — histórico, ranking e partidas salvas indisponíveis.</p>
          )}

          {/* ── HTTP ──────────────────────────────────────────────── */}
          <Section title="HTTP" hint={`${p.totalHttpRequests} requisições · ${p.httpErrors} erros 5xx (${pct(p.httpErrors, p.totalHttpRequests)})`}>
            <div className="card">
              <BarChart data={p.httpRequests} limit={10} labelWidth="w-36 sm:w-48" />
            </div>
          </Section>

          {/* ── Acessos Recentes ──────────────────────────────────── */}
          {data.recentAccesses.length > 0 && (
            <Section title="Acessos recentes">
              <div className="card">
                <Table
                  head={['IP (anonimizado)', 'País', 'Cidade / Região', 'Rota', 'Horário']}
                  leftCols={4}
                  rows={data.recentAccesses.slice(0, 50).map((entry) => [
                    <span key="ip" className="font-mono text-xs">{entry.anonymizedIp}</span>,
                    entry.country ?? '—',
                    [entry.city, entry.region].filter(Boolean).join(', ') || '—',
                    <span key="r" className="font-mono text-xs">{entry.method} {entry.route}</span>,
                    new Date(entry.timestamp).toLocaleTimeString('pt-BR'),
                  ])}
                />
              </div>
            </Section>
          )}
        </motion.div>
      )}
    </div>
  );
}
