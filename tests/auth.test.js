// tests/auth.test.js
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { initDb } = require('../db');

let app, db;

beforeAll(() => {
  process.env.SAHIL_EMAIL = 'sahil@test.com';
  process.env.WIFE_EMAIL = 'wife@test.com';
  process.env.SESSION_SECRET = 'test-secret';
  process.env.SITE_URL = 'http://localhost:3000';

  db = initDb(':memory:');

  app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  }));

  const authRoutes = require('../routes/auth');
  app.use('/api/auth', authRoutes);
});

afterAll(() => {
  db.close();
});

describe('POST /api/auth/login', () => {
  test('returns 400 for missing email', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com' });
    expect(res.status).toBe(404);
  });

  test('returns 200 and creates magic link for valid email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'sahil@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Magic link sent');

    const link = db.prepare('SELECT * FROM magic_links WHERE email = ?').get('sahil@test.com');
    expect(link).toBeDefined();
    expect(link.used).toBe(0);
  });
});

describe('GET /api/auth/verify', () => {
  test('returns 400 for missing token', async () => {
    const res = await request(app).get('/api/auth/verify');
    expect(res.status).toBe(400);
  });

  test('returns 401 for invalid token', async () => {
    const res = await request(app).get('/api/auth/verify').query({ token: 'bogus' });
    expect(res.status).toBe(401);
  });

  test('verifies valid token and redirects', async () => {
    const token = db.prepare('SELECT token FROM magic_links WHERE email = ?').get('sahil@test.com').token;
    const res = await request(app).get('/api/auth/verify').query({ token });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/requests.html');

    const link = db.prepare('SELECT * FROM magic_links WHERE token = ?').get(token);
    expect(link.used).toBe(1);
  });
});
