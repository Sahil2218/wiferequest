// routes/auth.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../db');
const { sendMagicLink } = require('../email');

router.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'Email not found' });

  const token = crypto.randomBytes(36).toString('base64url');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)').run(email, token, expiresAt);

  try {
    await sendMagicLink(email, token);
  } catch (err) {
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
