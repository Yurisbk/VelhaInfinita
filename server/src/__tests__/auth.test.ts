import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../app';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('POST /api/auth/register', () => {
  it('cria usuário e retorna token JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', username: 'Teste', password: '123456' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: 'test@test.com', username: 'Teste' });
  });

  it('rejeita e-mail duplicado', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', username: 'A', password: '123456' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', username: 'B', password: '123456' });

    expect(res.status).toBe(409);
  });

  it('rejeita senha curta', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@test.com', username: 'S', password: '123' });
    expect(res.status).toBe(400);
  });

  it('rejeita payload sem e-mail', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'NoEmail', password: '123456' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@test.com', username: 'LoginUser', password: 'senha123' });
  });

  it('retorna token com credenciais corretas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'senha123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejeita senha errada', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'errada' });

    expect(res.status).toBe(401);
  });

  it('rejeita e-mail inexistente', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao@existe.com', password: '123456' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('retorna o usuário com token válido', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'me@test.com', username: 'MeUser', password: '123456' });

    const token = reg.body.token as string;
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('email', 'me@test.com');
  });

  it('rejeita sem token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejeita token inválido', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer tokeninvalido');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('retorna status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
