/**
 * Integration tests for the online modes, the ranking system and the metrics
 * they feed: ranked ELO, abandonment, rematch, queues, local/CPU reporting.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import http from 'http';

process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'test-admin-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

let mongod: MongoMemoryServer;
let serverAddress: string;
let httpServer: http.Server;
const sockets: ClientSocket[] = [];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const { server } = await import('../app');
  httpServer = server;
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address() as { port: number };
  serverAddress = `http://127.0.0.1:${addr.port}`;
});

afterEach(() => {
  while (sockets.length) sockets.pop()!.disconnect();
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await mongoose.disconnect().catch(() => {});
  await mongod.stop();
});

function connect(): Promise<ClientSocket> {
  return new Promise((resolve) => {
    const s = ioClient(serverAddress, { transports: ['websocket'], forceNew: true });
    sockets.push(s);
    s.on('connect', () => resolve(s));
  });
}

function once<T = unknown>(s: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    s.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface Started { symbol: 'X' | 'O'; opponentName?: string }
interface State { winner: 'X' | 'O' | null; currentPlayer: 'X' | 'O' }

/** Puts two sockets in a match through the given queue and returns them ordered as [X, O]. */
async function matchPair(
  queue: 'join_queue' | 'join_ranked_queue',
  ids: [string, string] = ['player-aaaa-0001', 'player-bbbb-0002'],
): Promise<{ x: ClientSocket; o: ClientSocket; xId: string; oId: string }> {
  const a = await connect();
  const b = await connect();
  const aStart = once<Started>(a, 'game_start');
  const bStart = once<Started>(b, 'game_start');
  a.emit(queue, { name: 'Alice', symbol: 'X', playerId: ids[0] });
  await once(a, 'queue_joined');
  b.emit(queue, { name: 'Bob', symbol: 'O', playerId: ids[1] });
  const [sa, sb] = await Promise.all([aStart, bStart]);
  expect(sa.opponentName).toBe('Bob');
  expect(sb.opponentName).toBe('Alice');
  return sa.symbol === 'X'
    ? { x: a, o: b, xId: ids[0], oId: ids[1] }
    : { x: b, o: a, xId: ids[1], oId: ids[0] };
}

/** X plays 0,1,2 (top row) while O plays 3,4 — X wins on the 5th move. */
async function playXWins(x: ClientSocket, o: ClientSocket): Promise<State> {
  const seq: [ClientSocket, number][] = [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]];
  let last: State | null = null;
  for (const [s, idx] of seq) {
    const update = once<State>(x, 'game_update');
    s.emit('make_move', idx);
    last = await update;
  }
  return last!;
}

describe('Ranked mode', () => {
  it('applies ELO to both players and exposes it via the player API and leaderboard', async () => {
    const { x, o, xId, oId } = await matchPair('join_ranked_queue', ['ranked-win-0001', 'ranked-lose-0002']);
    const xElo = once<{ newElo: number; delta: number }>(x, 'elo_update');
    const oElo = once<{ newElo: number; delta: number }>(o, 'elo_update');

    const final = await playXWins(x, o);
    expect(final.winner).toBe('X');

    expect(await xElo).toEqual({ newElo: 1016, delta: 16 });
    expect(await oElo).toEqual({ newElo: 984, delta: -16 });

    const winner = await request(serverAddress).get(`/api/player/${xId}`);
    expect(winner.status).toBe(200);
    expect(winner.body).toMatchObject({ elo: 1016, rankedWins: 1, rankedLosses: 0, rank: 1 });

    const loser = await request(serverAddress).get(`/api/player/${oId}`);
    expect(loser.body).toMatchObject({ elo: 984, rankedWins: 0, rankedLosses: 1 });

    const board = await request(serverAddress).get('/api/player/leaderboard');
    expect(board.status).toBe(200);
    expect(board.body[0]).toMatchObject({ elo: 1016 });
    expect(board.body.every((p: { elo: number }, i: number, arr: { elo: number }[]) => i === 0 || arr[i - 1].elo >= p.elo)).toBe(true);
  });

  it('saves the ranked game record with mode "ranked"', async () => {
    const { GameRecord } = await import('../models/GameRecord');
    const before = await GameRecord.countDocuments({ mode: 'ranked' });
    const { x, o } = await matchPair('join_ranked_queue', ['ranked-rec-0001', 'ranked-rec-0002']);
    await playXWins(x, o);
    await wait(200);
    expect(await GameRecord.countDocuments({ mode: 'ranked' })).toBe(before + 1);
  });

  it('never matches the same player id against itself (two tabs)', async () => {
    const a = await connect();
    const b = await connect();
    a.emit('join_ranked_queue', { name: 'Same', playerId: 'same-player-0001' });
    await once(a, 'queue_joined');
    b.emit('join_ranked_queue', { name: 'Same', playerId: 'same-player-0001' });
    const joined = await once<{ position: number }>(b, 'queue_joined');
    expect(joined.position).toBe(2);
  });

  it('rejects a missing or malformed playerId', async () => {
    const a = await connect();
    a.emit('join_ranked_queue', { name: 'NoId' });
    expect(await once<string>(a, 'error')).toMatch(/identificador/i);
    a.emit('join_ranked_queue', { name: 'BadId', playerId: '../../etc' });
    expect(await once<string>(a, 'error')).toMatch(/identificador/i);
  });

  it('counts abandoning a ranked game as a loss', async () => {
    const { x, o, oId } = await matchPair('join_ranked_queue', ['ranked-stay-0001', 'ranked-quit-0002']);
    const left = once<{ winner: string | null }>(x, 'opponent_left');
    const elo = once<{ delta: number }>(x, 'elo_update');
    o.disconnect();
    expect((await left).winner).toBe('X');
    expect((await elo).delta).toBeGreaterThan(0);
    const quitter = await request(serverAddress).get(`/api/player/${oId}`);
    expect(quitter.body.rankedLosses).toBe(1);
  });
});

describe('Quick match and rooms', () => {
  it('leave_queue removes the player and allows searching again', async () => {
    const a = await connect();
    a.emit('join_queue', { name: 'Solo' });
    await once(a, 'queue_joined');
    a.emit('leave_queue');
    await once(a, 'queue_left');
    a.emit('join_queue', { name: 'Solo' });
    const joined = await once<{ position: number }>(a, 'queue_joined');
    expect(joined.position).toBe(1);
  });

  it('opponent leaving mid-game gives the win; leaving after the game does not', async () => {
    const first = await matchPair('join_queue');
    const left = once<{ winner: string | null }>(first.x, 'opponent_left');
    first.o.emit('leave_room');
    expect((await left).winner).toBe('X');

    const second = await matchPair('join_queue');
    await playXWins(second.x, second.o);
    const leftAfter = once<{ winner: string | null }>(second.o, 'opponent_left');
    second.x.emit('leave_room');
    expect((await leftAfter).winner).toBeNull();
  });

  it('frees the remaining player so they can queue again after the opponent leaves', async () => {
    const { x, o } = await matchPair('join_queue');
    const left = once(x, 'opponent_left');
    o.emit('leave_room');
    await left;
    x.emit('join_queue', { name: 'Again' });
    const joined = await once<{ position: number }>(x, 'queue_joined');
    expect(joined.position).toBe(1);
  });

  it('rematch restarts the board and swaps symbols', async () => {
    const { x, o } = await matchPair('join_queue');
    await playXWins(x, o);

    const requested = once(o, 'rematch_requested');
    x.emit('request_rematch');
    await requested;

    const xRestart = once<Started>(x, 'game_start');
    const oRestart = once<Started>(o, 'game_start');
    const update = once<State>(x, 'game_update');
    o.emit('request_rematch');

    expect((await xRestart).symbol).toBe('O');
    expect((await oRestart).symbol).toBe('X');
    expect((await update).winner).toBeNull();
  });

  it('online room honors the creator symbol choice', async () => {
    const host = await connect();
    const guest = await connect();
    host.emit('create_room', { name: 'Host', symbol: 'O' });
    const code = await once<string>(host, 'room_created');
    const hostStart = once<Started>(host, 'game_start');
    const guestStart = once<Started>(guest, 'game_start');
    guest.emit('join_room', { code, name: 'Guest' });
    expect((await hostStart).symbol).toBe('O');
    expect((await guestStart).symbol).toBe('X');
  });

  it('does not let the room creator move before an opponent joins', async () => {
    const host = await connect();
    host.emit('create_room', { name: 'Host' });
    await once(host, 'room_created');
    let updated = false;
    host.on('game_update', () => { updated = true; });
    host.emit('make_move', 4);
    await wait(200);
    expect(updated).toBe(false);
  });
});

describe('POST /api/stats/game (local and CPU results)', () => {
  const valid = { mode: 'cpu', winner: 'O', moves: [0, 4, 1, 2, 6, 3, 5], durationSeconds: 12, difficulty: 'insane', humanSymbol: 'X' };

  it('accepts a valid CPU game', async () => {
    const res = await request(serverAddress).post('/api/stats/game').send(valid);
    expect(res.status).toBe(201);
  });

  it('accepts a valid local game', async () => {
    const res = await request(serverAddress)
      .post('/api/stats/game')
      .send({ mode: 'local', winner: 'X', moves: [0, 3, 1, 4, 2], durationSeconds: 8 });
    expect(res.status).toBe(201);
  });

  it.each([
    ['online modes', { ...valid, mode: 'ranked' }],
    ['bad winner', { ...valid, winner: 'Z' }],
    ['out of range move', { ...valid, moves: [0, 9] }],
    ['unknown difficulty', { ...valid, difficulty: 'godlike' }],
    ['negative duration', { ...valid, durationSeconds: -1 }],
  ])('rejects %s', async (_label, body) => {
    const res = await request(serverAddress).post('/api/stats/game').send(body);
    expect(res.status).toBe(400);
  });
});

describe('Metrics', () => {
  async function metricsText(): Promise<string> {
    return (await request(serverAddress).get('/metrics')).text;
  }

  function gauge(text: string, name: string): number {
    const line = text.split('\n').find((l) => l.startsWith(`${name} `));
    return line ? Number(line.split(' ')[1]) : NaN;
  }

  it('socket_connections_active goes back down when sockets disconnect', async () => {
    const before = gauge(await metricsText(), 'socket_connections_active');
    const s = await connect();
    await wait(50);
    expect(gauge(await metricsText(), 'socket_connections_active')).toBe(before + 1);
    s.disconnect();
    await wait(100);
    expect(gauge(await metricsText(), 'socket_connections_active')).toBe(before);
  });

  it('labels HTTP metrics by route pattern, not by concrete URL', async () => {
    await request(serverAddress).get('/api/player/some-unique-id-123');
    const text = await metricsText();
    expect(text).toContain('route="/api/player/:id"');
    expect(text).not.toContain('some-unique-id-123');
  });

  it('exposes the new game metrics in the admin dashboard', async () => {
    const res = await request(serverAddress)
      .get('/api/admin/dashboard')
      .set('x-admin-password', 'test-admin-secret');
    expect(res.status).toBe(200);
    expect(res.body.prometheus).toHaveProperty('queueSizes');
    expect(res.body.prometheus).toHaveProperty('avgDuration');
    expect(res.body.prometheus.cpuByDifficulty.insane).toBeDefined();
    expect(res.body.mongo).toHaveProperty('leaderboard');
    expect(res.body.recentAccesses[0]).not.toHaveProperty('ip');
  });
});
