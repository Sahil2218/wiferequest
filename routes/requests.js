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
