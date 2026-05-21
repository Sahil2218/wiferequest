// tests/requests.test.js
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { initDb } = require('../db');

let app, db, agent;

beforeAll(() => {
  process.env.SAHIL_EMAIL = 'sahil@test.com';
  process.env.WIFE_EMAIL = 'wife@test.com';

  db = initDb(':memory:');

  app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  }));

  // Mock session for requester
  app.use('/api/requester', (req, res, next) => {
    req.session.userId = 1;
    req.session.role = 'requester';
    req.session.email = 'sahil@test.com';
    req.session.name = 'Sahil dino';
    next();
  });

  // Mock session for approver
  app.use('/api/approver', (req, res, next) => {
    req.session.userId = 2;
    req.session.role = 'approver';
    req.session.email = 'wife@test.com';
    req.session.name = 'Wife';
    next();
  });

  const requestRoutes = require('../routes/requests');
  app.use('/api/requester', requestRoutes);
  app.use('/api/approver', requestRoutes);
});

afterAll(() => {
  db.close();
});

describe('POST /requests (create)', () => {
  test('requester can create a request', async () => {
    const res = await request(app)
      .post('/api/requester/requests')
      .send({ amount: 1000, reason: 'new shoes' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.amount).toBe(1000);
    expect(res.body.reason).toBe('new shoes');
    expect(res.body.status).toBe('pending');
  });

  test('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/requester/requests')
      .send({ amount: 500 });
    expect(res.status).toBe(400);
  });

  test('approver cannot create requests', async () => {
    const res = await request(app)
      .post('/api/approver/requests')
      .send({ amount: 500, reason: 'test' });
    expect(res.status).toBe(403);
  });
});

describe('GET /requests (list)', () => {
  test('returns all requests', async () => {
    const res = await request(app).get('/api/approver/requests');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('PATCH /requests/:id (approve)', () => {
  test('approver can approve a request', async () => {
    const res = await request(app)
      .patch('/api/approver/requests/1')
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.approved_at).toBeDefined();
  });

  test('requester cannot approve', async () => {
    const res = await request(app)
      .patch('/api/requester/requests/1')
      .send({ status: 'approved' });
    expect(res.status).toBe(403);
  });
});

describe('GET /notifications', () => {
  test('returns unseen count for approver', async () => {
    db.prepare('INSERT INTO requests (amount, reason) VALUES (?, ?)').run(200, 'coffee');
    const res = await request(app).get('/api/approver/notifications');
    expect(res.status).toBe(200);
    expect(res.body.unseen).toBeGreaterThanOrEqual(1);
  });
});
