const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { sendNewRequestNotification, sendApprovalNotification } = require('../email');
const { requireAuth, requireRole } = require('../middleware');

router.get('/requests', requireAuth, async (req, res) => {
  const sql = getDb();
  const requests = await sql`SELECT * FROM requests ORDER BY created_at DESC`;
  res.json(requests);
});

router.get('/requests/:id', requireAuth, async (req, res) => {
  const sql = getDb();
  const rows = await sql`SELECT * FROM requests WHERE id = ${req.params.id}`;
  if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });
  const row = rows[0];

  if (req.session.role === 'approver') {
    await sql`UPDATE requests SET seen = 1 WHERE id = ${row.id}`;
  }

  res.json(row);
});

router.post('/requests', requireAuth, requireRole('requester'), async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || !reason) return res.status(400).json({ error: 'Amount and reason are required' });

  const sql = getDb();
  const created = await sql`INSERT INTO requests (amount, reason) VALUES (${amount}, ${reason}) RETURNING *`;

  const wifeEmail = process.env.WIFE_EMAIL;
  if (wifeEmail) {
    sendNewRequestNotification(wifeEmail, amount, reason).catch(err => {
      console.log('Failed to send notification email:', err.message);
    });
  }

  res.status(201).json(created[0]);
});

router.patch('/requests/:id', requireAuth, requireRole('approver'), async (req, res) => {
  const { status } = req.body;
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const sql = getDb();
  const existing = await sql`SELECT * FROM requests WHERE id = ${req.params.id}`;
  if (existing.length === 0) return res.status(404).json({ error: 'Request not found' });

  const approvedAt = status === 'approved' ? new Date().toISOString() : null;
  const updated = await sql`
    UPDATE requests SET status = ${status}, approved_at = ${approvedAt}, seen = 1
    WHERE id = ${req.params.id} RETURNING *
  `;

  if (status === 'approved') {
    const sahilEmail = process.env.SAHIL_EMAIL;
    if (sahilEmail) {
      sendApprovalNotification(sahilEmail, updated[0].amount, updated[0].reason).catch(err => {
        console.log('Failed to send approval email:', err.message);
      });
    }
  }

  res.json(updated[0]);
});

router.get('/notifications', requireAuth, async (req, res) => {
  const sql = getDb();
  const result = await sql`SELECT COUNT(*) as unseen FROM requests WHERE seen = 0`;
  res.json({ unseen: parseInt(result[0].unseen) });
});

module.exports = router;
