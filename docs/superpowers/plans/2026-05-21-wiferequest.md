# WifeRequest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fun, quirky website where Sahil sends money requests to his wife via a cute letter template, she approves them from a dashboard, and both get email notifications.

**Architecture:** Single Express.js server with SQLite (better-sqlite3), serving vanilla HTML/CSS/JS from `/public`. Magic link authentication, session cookies, Nodemailer for email.

**Tech Stack:** Node.js, Express, better-sqlite3, Nodemailer, express-session, crypto (for tokens), vanilla HTML/CSS/JS

---

## File Structure

```
wiferequest/
├── server.js                 (Express app entry point — routes, middleware, server start)
├── db.js                     (Database initialization, schema, seed data)
├── routes/
│   ├── auth.js               (POST /api/auth/login, GET /api/auth/verify, GET /api/auth/logout)
│   └── requests.js           (CRUD + approve/reject + notifications count)
├── email.js                  (Nodemailer transporter + send functions)
├── middleware.js             (Session auth check middleware)
├── package.json
├── .env.example              (Template for required env vars)
├── public/
│   ├── index.html            (Login page)
│   ├── dashboard.html        (Wife's dashboard)
│   ├── requests.html         (Sahil's dashboard)
│   ├── letter.html           (Single request letter view)
│   ├── css/
│   │   └── style.css         (All styles — quirky theme)
│   └── js/
│       ├── login.js          (Login form logic)
│       ├── dashboard.js      (Wife's dashboard logic)
│       ├── requests.js       (Sahil's dashboard logic)
│       └── letter.js         (Letter view + approve logic)
├── tests/
│   ├── db.test.js            (Database layer tests)
│   ├── auth.test.js          (Auth routes tests)
│   └── requests.test.js      (Request routes tests)
├── CLAUDE.md
├── .gitignore
└── README.md
```

---

### Task 1: Project Setup & Database Layer

**Files:**
- Create: `package.json`
- Create: `db.js`
- Create: `.env.example`
- Create: `tests/db.test.js`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /Users/sahil.c/vscode/wiferequest
npm init -y
npm install express better-sqlite3 nodemailer express-session crypto-random-string dotenv
npm install --save-dev jest
```

Then edit `package.json` to add test script:

```json
{
  "scripts": {
    "start": "node server.js",
    "test": "jest"
  }
}
```

- [ ] **Step 2: Create .env.example**

```env
PORT=3000
SESSION_SECRET=change-me-to-a-random-string
SITE_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SAHIL_EMAIL=sahil@example.com
WIFE_EMAIL=wife@example.com
```

- [ ] **Step 3: Write failing test for database**

```javascript
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
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npm test -- tests/db.test.js
```

Expected: FAIL — `Cannot find module '../db'`

- [ ] **Step 5: Implement db.js**

```javascript
// db.js
const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDb(dbPath) {
  db = new Database(dbPath || path.join(__dirname, 'wiferequest.db'));

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('requester', 'approver'))
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      seen INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS magic_links (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0
    );
  `);

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insert = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)');
    insert.run('Sahil dino', process.env.SAHIL_EMAIL || 'sahil@example.com', 'requester');
    insert.run('Wife', process.env.WIFE_EMAIL || 'wife@example.com', 'approver');
  }

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

module.exports = { initDb, getDb };
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- tests/db.test.js
```

Expected: All 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json db.js .env.example tests/db.test.js
git commit -m "feat: add project setup and database layer with tests"
```

---

### Task 2: Auth Middleware & Routes

**Files:**
- Create: `middleware.js`
- Create: `routes/auth.js`
- Create: `email.js`
- Create: `tests/auth.test.js`

- [ ] **Step 1: Write failing test for auth routes**

```javascript
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
```

- [ ] **Step 2: Install supertest**

```bash
npm install --save-dev supertest
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/auth.test.js
```

Expected: FAIL — `Cannot find module '../routes/auth'`

- [ ] **Step 4: Implement email.js**

```javascript
// email.js
const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendMagicLink(email, token) {
  const url = `${process.env.SITE_URL}/api/auth/verify?token=${token}`;
  await getTransporter().sendMail({
    from: `"WifeRequest" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your Magic Login Link',
    html: `<p>Click here to login:</p><a href="${url}">${url}</a><p>Expires in 15 minutes.</p>`,
  });
}

async function sendNewRequestNotification(email, amount, reason) {
  const url = `${process.env.SITE_URL}/dashboard.html`;
  await getTransporter().sendMail({
    from: `"WifeRequest" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Sahil dino has a new request for you!',
    html: `<p>Sahil needs <strong>₹${amount}</strong> for <strong>${reason}</strong>.</p><p><a href="${url}">View request</a></p>`,
  });
}

async function sendApprovalNotification(email, amount, reason) {
  await getTransporter().sendMail({
    from: `"WifeRequest" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Your request for ₹${amount} was approved! 🎉`,
    html: `<p>Your request for <strong>₹${amount}</strong> (${reason}) was approved!</p>`,
  });
}

module.exports = { sendMagicLink, sendNewRequestNotification, sendApprovalNotification };
```

- [ ] **Step 5: Implement middleware.js**

```javascript
// middleware.js
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

- [ ] **Step 6: Implement routes/auth.js**

```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();
const cryptoRandomString = require('crypto-random-string');
const { getDb } = require('../db');
const { sendMagicLink } = require('../email');

router.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'Email not found' });

  const token = cryptoRandomString({ length: 48, type: 'url-safe' });
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)').run(email, token, expiresAt);

  try {
    await sendMagicLink(email, token);
  } catch (err) {
    // In dev, log but don't fail — email might not be configured
    console.log('Email send failed (dev mode?):', err.message);
  }

  res.json({ message: 'Magic link sent! Check your email.' });
});

router.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  const db = getDb();
  const link = db.prepare('SELECT * FROM magic_links WHERE token = ? AND used = 0').get(token);

  if (!link) return res.status(401).json({ error: 'Invalid or expired link' });

  const now = new Date();
  const expires = new Date(link.expires_at);
  if (now > expires) return res.status(401).json({ error: 'Link expired' });

  db.prepare('UPDATE magic_links SET used = 1 WHERE id = ?').run(link.id);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(link.email);

  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.role = user.role;
  req.session.name = user.name;

  const redirect = user.role === 'approver' ? '/dashboard.html' : '/requests.html';
  res.redirect(redirect);
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    id: req.session.userId,
    name: req.session.name,
    email: req.session.email,
    role: req.session.role,
  });
});

module.exports = router;
```

- [ ] **Step 7: Create routes directory**

```bash
mkdir -p routes
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npm test -- tests/auth.test.js
```

Expected: All 6 tests PASS

- [ ] **Step 9: Commit**

```bash
git add middleware.js email.js routes/auth.js tests/auth.test.js
git commit -m "feat: add magic link auth with email, middleware, and tests"
```

---

### Task 3: Request Routes

**Files:**
- Create: `routes/requests.js`
- Create: `tests/requests.test.js`

- [ ] **Step 1: Write failing test for request routes**

```javascript
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
    // Create another request that is unseen
    db.prepare('INSERT INTO requests (amount, reason) VALUES (?, ?)').run(200, 'coffee');
    const res = await request(app).get('/api/approver/notifications');
    expect(res.status).toBe(200);
    expect(res.body.unseen).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/requests.test.js
```

Expected: FAIL — `Cannot find module '../routes/requests'`

- [ ] **Step 3: Implement routes/requests.js**

```javascript
// routes/requests.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { sendNewRequestNotification, sendApprovalNotification } = require('../email');
const { requireAuth, requireRole } = require('../middleware');

router.get('/requests', requireAuth, (req, res) => {
  const db = getDb();
  const requests = db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all();
  res.json(requests);
});

router.get('/requests/:id', requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Request not found' });

  if (req.session.role === 'approver') {
    db.prepare('UPDATE requests SET seen = 1 WHERE id = ?').run(row.id);
  }

  res.json(row);
});

router.post('/requests', requireAuth, requireRole('requester'), (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || !reason) return res.status(400).json({ error: 'Amount and reason are required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO requests (amount, reason) VALUES (?, ?)').run(amount, reason);
  const created = db.prepare('SELECT * FROM requests WHERE id = ?').get(result.lastInsertRowid);

  const wifeEmail = process.env.WIFE_EMAIL;
  if (wifeEmail) {
    sendNewRequestNotification(wifeEmail, amount, reason).catch(err => {
      console.log('Failed to send notification email:', err.message);
    });
  }

  res.status(201).json(created);
});

router.patch('/requests/:id', requireAuth, requireRole('approver'), (req, res) => {
  const { status } = req.body;
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Request not found' });

  const approvedAt = status === 'approved' ? new Date().toISOString() : null;
  db.prepare('UPDATE requests SET status = ?, approved_at = ?, seen = 1 WHERE id = ?')
    .run(status, approvedAt, req.params.id);

  const updated = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);

  if (status === 'approved') {
    const sahilEmail = process.env.SAHIL_EMAIL;
    if (sahilEmail) {
      sendApprovalNotification(sahilEmail, updated.amount, updated.reason).catch(err => {
        console.log('Failed to send approval email:', err.message);
      });
    }
  }

  res.json(updated);
});

router.get('/notifications', requireAuth, (req, res) => {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as unseen FROM requests WHERE seen = 0').get();
  res.json({ unseen: result.unseen });
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/requests.test.js
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add routes/requests.js tests/requests.test.js
git commit -m "feat: add request CRUD routes with approve/reject and notifications"
```

---

### Task 4: Express Server Entry Point

**Files:**
- Create: `server.js`

- [ ] **Step 1: Implement server.js**

```javascript
// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

initDb();

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/requests'));

app.listen(PORT, () => {
  console.log(`WifeRequest running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Test server starts**

```bash
node -e "require('./server.js')" &
sleep 1 && curl -s http://localhost:3000/api/auth/me | head -c 100
kill %1 2>/dev/null
```

Expected: `{"error":"Not authenticated"}` (confirms server is running and routes work)

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add Express server entry point wiring all routes"
```

---

### Task 5: Login Page (Frontend)

**Files:**
- Create: `public/index.html`
- Create: `public/css/style.css`
- Create: `public/js/login.js`

- [ ] **Step 1: Create public directories**

```bash
mkdir -p public/css public/js
```

- [ ] **Step 2: Create style.css with quirky theme**

```css
/* public/css/style.css */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Caveat:wght@500;700&display=swap');

:root {
  --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  --pink: #f093fb;
  --purple: #764ba2;
  --orange: #f5af19;
  --dark: #1a1a2e;
  --card-bg: #ffffff;
  --shadow: 0 10px 40px rgba(118, 75, 162, 0.3);
  --radius: 16px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Poppins', sans-serif;
  background: var(--gradient);
  min-height: 100vh;
  color: var(--dark);
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.card {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 2.5rem;
  box-shadow: var(--shadow);
  animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes bounceIn {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes fadeUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.fade-up {
  animation: fadeUp 0.5s ease forwards;
}

h1 {
  font-size: 2rem;
  background: var(--gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
  margin-bottom: 0.5rem;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

input, textarea {
  width: 100%;
  padding: 0.85rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-family: inherit;
  font-size: 1rem;
  transition: border-color 0.3s, box-shadow 0.3s;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(118, 75, 162, 0.1);
}

.btn {
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 10px;
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  background: var(--gradient);
  color: white;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(118, 75, 162, 0.4);
}

.btn:active {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.message {
  text-align: center;
  padding: 1rem;
  border-radius: 10px;
  margin-top: 1rem;
  font-weight: 600;
  animation: fadeUp 0.3s ease;
}

.message.success {
  background: #d4edda;
  color: #155724;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
}

/* Dashboard styles */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 1.5rem;
}

.badge {
  background: #ff4757;
  color: white;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  animation: bounceIn 0.4s ease;
}

.request-list {
  list-style: none;
}

.request-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.2rem;
  margin-bottom: 0.75rem;
  background: #f8f9fa;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.request-item:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.request-item .amount {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--purple);
}

.request-item .reason {
  color: #666;
  font-size: 0.9rem;
}

.status-chip {
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-chip.pending { background: #fff3cd; color: #856404; }
.status-chip.approved { background: #d4edda; color: #155724; }
.status-chip.rejected { background: #f8d7da; color: #721c24; }

/* Letter styles */
.letter {
  font-family: 'Caveat', cursive;
  font-size: 1.4rem;
  line-height: 2;
  padding: 2rem;
  background: #fffef5;
  border: 2px dashed #e0d9c8;
  border-radius: var(--radius);
  margin-bottom: 2rem;
  animation: fadeUp 0.6s ease;
}

.letter .amount-highlight {
  font-weight: 700;
  color: var(--purple);
  font-size: 1.6rem;
}

.letter .sign-off {
  margin-top: 1.5rem;
  font-style: italic;
}

.approve-btn {
  background: linear-gradient(135deg, #11998e, #38ef7d);
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  width: 100%;
  transition: transform 0.2s;
}

.approve-btn:hover { transform: scale(1.02); }

.reject-btn {
  background: #f8d7da;
  color: #721c24;
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  width: 100%;
  margin-top: 0.75rem;
  transition: transform 0.2s;
}

.reject-btn:hover { transform: scale(1.02); }

.logout-btn {
  background: none;
  border: 2px solid rgba(255,255,255,0.3);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
  font-size: 0.85rem;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  max-width: 600px;
  margin: 0 auto;
}

.top-bar .user-name {
  color: white;
  font-weight: 600;
}

/* Confetti container */
.confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}
```

- [ ] **Step 3: Create index.html (login page)**

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WifeRequest - Login</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container" style="display: flex; align-items: center; min-height: 100vh;">
    <div class="card" style="width: 100%;">
      <h1>WifeRequest</h1>
      <p class="subtitle">The cutest way to ask for money</p>
      <form id="login-form">
        <div class="form-group">
          <label for="email">Your Email</label>
          <input type="email" id="email" placeholder="Enter your email..." required>
        </div>
        <button type="submit" class="btn" id="submit-btn">Send Magic Link</button>
      </form>
      <div id="message" style="display: none;"></div>
    </div>
  </div>
  <script src="/js/login.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create login.js**

```javascript
// public/js/login.js
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const btn = document.getElementById('submit-btn');
  const msg = document.getElementById('message');

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    msg.style.display = 'block';
    if (res.ok) {
      msg.className = 'message success';
      msg.textContent = data.message;
    } else {
      msg.className = 'message error';
      msg.textContent = data.error;
    }
  } catch (err) {
    msg.style.display = 'block';
    msg.className = 'message error';
    msg.textContent = 'Something went wrong. Try again!';
  }

  btn.disabled = false;
  btn.textContent = 'Send Magic Link';
});

// If already logged in, redirect
fetch('/api/auth/me').then(res => {
  if (res.ok) return res.json();
}).then(user => {
  if (user) {
    window.location.href = user.role === 'approver' ? '/dashboard.html' : '/requests.html';
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add public/
git commit -m "feat: add login page with quirky CSS theme"
```

---

### Task 6: Sahil's Dashboard (Requester View)

**Files:**
- Create: `public/requests.html`
- Create: `public/js/requests.js`

- [ ] **Step 1: Create requests.html**

```html
<!-- public/requests.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WifeRequest - My Requests</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="top-bar">
    <span class="user-name" id="user-name"></span>
    <button class="logout-btn" onclick="logout()">Logout</button>
  </div>
  <div class="container">
    <div class="card" style="margin-bottom: 1.5rem;">
      <h1>New Request</h1>
      <p class="subtitle">Ask your cute wife for some funds</p>
      <form id="request-form">
        <div class="form-group">
          <label for="amount">Amount (₹)</label>
          <input type="number" id="amount" placeholder="How much do you need?" min="1" required>
        </div>
        <div class="form-group">
          <label for="reason">Reason</label>
          <textarea id="reason" rows="3" placeholder="What's it for?" required></textarea>
        </div>
        <button type="submit" class="btn" id="submit-btn">Send Request</button>
      </form>
      <div id="message" style="display: none;"></div>
    </div>

    <div class="card">
      <h2 style="margin-bottom: 1rem;">Past Requests</h2>
      <ul class="request-list" id="request-list"></ul>
      <p id="empty-state" style="text-align:center; color:#999; display:none;">No requests yet. Send your first one!</p>
    </div>
  </div>
  <script src="/js/requests.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create requests.js (frontend)**

```javascript
// public/js/requests.js
async function checkAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) { window.location.href = '/'; return null; }
  const user = await res.json();
  if (user.role !== 'requester') { window.location.href = '/dashboard.html'; return null; }
  document.getElementById('user-name').textContent = user.name;
  return user;
}

async function loadRequests() {
  const res = await fetch('/api/requests');
  if (!res.ok) return;
  const requests = await res.json();
  const list = document.getElementById('request-list');
  const empty = document.getElementById('empty-state');

  if (requests.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = requests.map(r => `
    <li class="request-item" onclick="window.location.href='/letter.html?id=${r.id}'">
      <div>
        <div class="amount">₹${r.amount}</div>
        <div class="reason">${r.reason}</div>
      </div>
      <span class="status-chip ${r.status}">${r.status}</span>
    </li>
  `).join('');
}

document.getElementById('request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = document.getElementById('amount').value;
  const reason = document.getElementById('reason').value;
  const btn = document.getElementById('submit-btn');
  const msg = document.getElementById('message');

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), reason }),
    });
    const data = await res.json();

    msg.style.display = 'block';
    if (res.ok) {
      msg.className = 'message success';
      msg.textContent = 'Request sent to your wife!';
      document.getElementById('request-form').reset();
      loadRequests();
    } else {
      msg.className = 'message error';
      msg.textContent = data.error;
    }
  } catch (err) {
    msg.style.display = 'block';
    msg.className = 'message error';
    msg.textContent = 'Something went wrong!';
  }

  btn.disabled = false;
  btn.textContent = 'Send Request';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
});

function logout() {
  window.location.href = '/api/auth/logout';
}

checkAuth().then(user => { if (user) loadRequests(); });
```

- [ ] **Step 3: Commit**

```bash
git add public/requests.html public/js/requests.js
git commit -m "feat: add Sahil's request creation dashboard"
```

---

### Task 7: Wife's Dashboard (Approver View)

**Files:**
- Create: `public/dashboard.html`
- Create: `public/js/dashboard.js`

- [ ] **Step 1: Create dashboard.html**

```html
<!-- public/dashboard.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WifeRequest - Dashboard</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="top-bar">
    <span class="user-name" id="user-name"></span>
    <div style="display:flex; align-items:center; gap:1rem;">
      <div class="badge" id="badge" style="display:none;">0</div>
      <button class="logout-btn" onclick="logout()">Logout</button>
    </div>
  </div>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>Requests</h1>
        <div style="display:flex; gap:0.5rem;">
          <button class="filter-btn" data-filter="all" onclick="filterRequests('all')">All</button>
          <button class="filter-btn" data-filter="pending" onclick="filterRequests('pending')">Pending</button>
          <button class="filter-btn" data-filter="approved" onclick="filterRequests('approved')">Approved</button>
        </div>
      </div>
      <ul class="request-list" id="request-list"></ul>
      <p id="empty-state" style="text-align:center; color:#999; display:none;">No requests here!</p>
    </div>
  </div>

  <style>
    .filter-btn {
      padding: 0.4rem 0.8rem;
      border: 2px solid var(--purple);
      background: none;
      border-radius: 8px;
      font-family: inherit;
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      color: var(--purple);
      transition: all 0.2s;
    }
    .filter-btn.active, .filter-btn:hover {
      background: var(--purple);
      color: white;
    }
  </style>
  <script src="/js/dashboard.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create dashboard.js**

```javascript
// public/js/dashboard.js
let allRequests = [];
let currentFilter = 'all';

async function checkAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) { window.location.href = '/'; return null; }
  const user = await res.json();
  if (user.role !== 'approver') { window.location.href = '/requests.html'; return null; }
  document.getElementById('user-name').textContent = user.name;
  return user;
}

async function loadNotifications() {
  const res = await fetch('/api/notifications');
  if (!res.ok) return;
  const data = await res.json();
  const badge = document.getElementById('badge');
  if (data.unseen > 0) {
    badge.style.display = 'flex';
    badge.textContent = data.unseen;
  } else {
    badge.style.display = 'none';
  }
}

async function loadRequests() {
  const res = await fetch('/api/requests');
  if (!res.ok) return;
  allRequests = await res.json();
  renderRequests();
}

function renderRequests() {
  const filtered = currentFilter === 'all'
    ? allRequests
    : allRequests.filter(r => r.status === currentFilter);

  const list = document.getElementById('request-list');
  const empty = document.getElementById('empty-state');

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === currentFilter);
  });

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = filtered.map(r => `
    <li class="request-item ${r.seen ? '' : 'unseen'}" onclick="window.location.href='/letter.html?id=${r.id}'">
      <div>
        <div class="amount">₹${r.amount}</div>
        <div class="reason">${r.reason}</div>
      </div>
      <span class="status-chip ${r.status}">${r.status}</span>
    </li>
  `).join('');
}

function filterRequests(filter) {
  currentFilter = filter;
  renderRequests();
}

function logout() {
  window.location.href = '/api/auth/logout';
}

checkAuth().then(user => {
  if (user) {
    loadRequests();
    loadNotifications();
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add public/dashboard.html public/js/dashboard.js
git commit -m "feat: add wife's approval dashboard with filters and badge"
```

---

### Task 8: Letter View with Approve/Reject & Confetti

**Files:**
- Create: `public/letter.html`
- Create: `public/js/letter.js`

- [ ] **Step 1: Create letter.html**

```html
<!-- public/letter.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WifeRequest - Letter</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="top-bar">
    <button class="logout-btn" onclick="goBack()">← Back</button>
    <button class="logout-btn" onclick="logout()">Logout</button>
  </div>
  <div class="container">
    <div class="card">
      <div class="letter" id="letter-content">
        Loading...
      </div>
      <div id="actions" style="display:none;"></div>
      <div id="status-display" style="display:none; text-align:center; padding:1rem;"></div>
    </div>
  </div>
  <div class="confetti-container" id="confetti"></div>
  <script src="/js/letter.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create letter.js with confetti**

```javascript
// public/js/letter.js
let currentUser = null;

async function checkAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) { window.location.href = '/'; return null; }
  return await res.json();
}

async function loadRequest() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { window.location.href = '/'; return; }

  const res = await fetch(`/api/requests/${id}`);
  if (!res.ok) { window.location.href = '/'; return; }
  const req = await res.json();

  const letterEl = document.getElementById('letter-content');
  letterEl.innerHTML = `
    <p>Hi my cute wife,</p>
    <p>I need <span class="amount-highlight">₹${req.amount}</span> for <strong>${req.reason}</strong>.</p>
    <p>So can you send it to me so I can fulfil our dreams with it. Please find attached texts and approve it.</p>
    <br>
    <p><strong>AMT-</strong> <span class="amount-highlight">₹${req.amount}</span></p>
    <p><strong>REASON-</strong> ${req.reason}</p>
    <br>
    <p>I will always love you till eternity.</p>
    <div class="sign-off">
      <p>Ur husband</p>
      <p><strong>Sahil dino</strong></p>
    </div>
  `;

  const actions = document.getElementById('actions');
  const statusDisplay = document.getElementById('status-display');

  if (req.status !== 'pending') {
    statusDisplay.style.display = 'block';
    statusDisplay.innerHTML = `<span class="status-chip ${req.status}" style="font-size:1rem; padding:0.5rem 1.5rem;">${req.status === 'approved' ? 'Approved ✓' : 'Rejected ✗'}</span>`;
    return;
  }

  if (currentUser && currentUser.role === 'approver') {
    actions.style.display = 'block';
    actions.innerHTML = `
      <button class="approve-btn" onclick="handleAction(${req.id}, 'approved')">Approve ✓</button>
      <button class="reject-btn" onclick="handleAction(${req.id}, 'rejected')">Reject ✗</button>
    `;
  }
}

async function handleAction(id, status) {
  const res = await fetch(`/api/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (res.ok) {
    document.getElementById('actions').style.display = 'none';
    const statusDisplay = document.getElementById('status-display');
    statusDisplay.style.display = 'block';

    if (status === 'approved') {
      statusDisplay.innerHTML = `<span class="status-chip approved" style="font-size:1rem; padding:0.5rem 1.5rem;">Approved ✓</span>`;
      launchConfetti();
    } else {
      statusDisplay.innerHTML = `<span class="status-chip rejected" style="font-size:1rem; padding:0.5rem 1.5rem;">Rejected ✗</span>`;
    }
  }
}

function launchConfetti() {
  const container = document.getElementById('confetti');
  const colors = ['#f093fb', '#764ba2', '#667eea', '#f5af19', '#38ef7d', '#ff4757'];

  for (let i = 0; i < 100; i++) {
    const piece = document.createElement('div');
    piece.style.cssText = `
      position: fixed;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}vw;
      top: -10px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    container.appendChild(piece);
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes confettiFall {
      to {
        transform: translateY(110vh) rotate(${Math.random() * 720}deg);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

function goBack() {
  if (currentUser && currentUser.role === 'approver') {
    window.location.href = '/dashboard.html';
  } else {
    window.location.href = '/requests.html';
  }
}

function logout() {
  window.location.href = '/api/auth/logout';
}

checkAuth().then(user => {
  currentUser = user;
  if (user) loadRequest();
});
```

- [ ] **Step 3: Commit**

```bash
git add public/letter.html public/js/letter.js
git commit -m "feat: add letter view with approve/reject and confetti animation"
```

---

### Task 9: Update CLAUDE.md & Final Polish

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update CLAUDE.md with project info**

Replace the contents of `CLAUDE.md` with:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — run the Express server (requires `.env` file)
- `npm test` — run all Jest tests
- `npm test -- tests/db.test.js` — run a single test file
- `node server.js` — start dev server at http://localhost:3000

## Architecture

Single Express.js server with SQLite (better-sqlite3). No build step — vanilla HTML/CSS/JS frontend served from `/public`.

**Backend:** `server.js` → `routes/auth.js` + `routes/requests.js` → `db.js` (SQLite)

**Auth:** Magic link emails via Nodemailer. Session cookies (express-session). Two hardcoded users: requester (Sahil) and approver (Wife). Emails configured via env vars.

**Frontend pages:**
- `/` → Login (email magic link)
- `/requests.html` → Sahil's dashboard (create + view requests)
- `/dashboard.html` → Wife's dashboard (view + approve/reject)
- `/letter.html?id=N` → Single request as styled letter

**Key patterns:**
- `middleware.js` exports `requireAuth` and `requireRole(role)` for route protection
- `email.js` wraps Nodemailer with specific send functions
- Frontend JS files check `/api/auth/me` on load and redirect if unauthorized
- Tests use in-memory SQLite (`:memory:`) and supertest
```

- [ ] **Step 2: Update README.md**

Replace the contents of `README.md` with:

```markdown
# wiferequest

The cutest way to ask your wife for money.

## Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. Run:
   ```bash
   npm start
   ```

4. Open http://localhost:3000

## How it works

- Sahil logs in via magic link → creates money requests
- Wife logs in via magic link → sees requests on her dashboard
- Each request appears as a cute letter she can approve
- Both get email notifications
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README with project documentation"
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 5: Start server and verify manually**

```bash
npm start
```

Open http://localhost:3000 — login page should render with the quirky gradient theme.

- [ ] **Step 6: Final commit and push**

```bash
git push origin main
```

---

Plan complete and saved to `docs/superpowers/plans/2026-05-21-wiferequest.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?