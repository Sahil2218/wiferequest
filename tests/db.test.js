// tests/db.test.js
const { getDb, initDb } = require('../db');

describe('Database', () => {
  let db;

  beforeAll(() => {
    db = initDb(':memory:');
  });

  afterAll(() => {
    db.close();
  });

  test('creates users table with seeded data', () => {
    const users = db.prepare('SELECT * FROM users').all();
    expect(users).toHaveLength(2);
    expect(users[0].role).toBe('requester');
    expect(users[1].role).toBe('approver');
  });

  test('creates requests table', () => {
    const info = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'").get();
    expect(info).toBeDefined();
  });

  test('creates magic_links table', () => {
    const info = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='magic_links'").get();
    expect(info).toBeDefined();
  });

  test('inserts a request', () => {
    db.prepare('INSERT INTO requests (amount, reason) VALUES (?, ?)').run(500, 'groceries');
    const req = db.prepare('SELECT * FROM requests WHERE reason = ?').get('groceries');
    expect(req.amount).toBe(500);
    expect(req.status).toBe('pending');
    expect(req.seen).toBe(0);
  });
});
