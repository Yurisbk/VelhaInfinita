import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const gamesStartedTotal = new client.Counter({
  name: 'games_started_total',
  help: 'Total number of games started',
  labelNames: ['mode'],
  registers: [register],
});

export const gamesWonTotal = new client.Counter({
  name: 'games_won_total',
  help: 'Total number of games won',
  labelNames: ['mode', 'winner'],
  registers: [register],
});

export const gamesAbandonedTotal = new client.Counter({
  name: 'games_abandoned_total',
  help: 'Games ended because a player left before a winner was decided',
  labelNames: ['mode'],
  registers: [register],
});

export const rematchesTotal = new client.Counter({
  name: 'rematches_total',
  help: 'Rematches accepted by both players',
  labelNames: ['mode'],
  registers: [register],
});

export const gameDurationSeconds = new client.Histogram({
  name: 'game_duration_seconds',
  help: 'Duration of finished games in seconds',
  labelNames: ['mode'],
  buckets: [10, 30, 60, 120, 300, 600, 1200],
  registers: [register],
});

export const gameMoves = new client.Histogram({
  name: 'game_moves',
  help: 'Number of moves in finished games',
  labelNames: ['mode'],
  buckets: [5, 7, 9, 12, 15, 20, 30, 50],
  registers: [register],
});

export const cpuGamesTotal = new client.Counter({
  name: 'cpu_games_total',
  help: 'Finished games against the CPU by difficulty and who won',
  labelNames: ['difficulty', 'result'],
  registers: [register],
});

export const matchmakingQueueSize = new client.Gauge({
  name: 'matchmaking_queue_size',
  help: 'Players currently waiting in a matchmaking queue',
  labelNames: ['queue'],
  registers: [register],
});

export const matchmakingWaitSeconds = new client.Histogram({
  name: 'matchmaking_wait_seconds',
  help: 'Time a player waited in queue before being matched',
  labelNames: ['queue'],
  buckets: [1, 3, 5, 10, 20, 30, 45, 60],
  registers: [register],
});

export const matchmakingTimeoutsTotal = new client.Counter({
  name: 'matchmaking_timeouts_total',
  help: 'Queue searches that ended without an opponent',
  labelNames: ['queue'],
  registers: [register],
});

export const eloUpdatesTotal = new client.Counter({
  name: 'elo_updates_total',
  help: 'Ranked results applied to player ELO',
  labelNames: ['status'],
  registers: [register],
});

export const activeSocketConnections = new client.Gauge({
  name: 'socket_connections_active',
  help: 'Number of currently active socket connections',
  registers: [register],
});

export const activeGameRooms = new client.Gauge({
  name: 'game_rooms_active',
  help: 'Number of active game rooms',
  registers: [register],
});

export { register };
