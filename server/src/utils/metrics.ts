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
