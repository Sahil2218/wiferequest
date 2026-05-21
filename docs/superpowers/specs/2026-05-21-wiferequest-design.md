# WifeRequest — Design Spec

## Overview

A fun, quirky website where Sahil sends money requests to his wife using a cute letter template. She gets a dashboard of requests, opens each as a beautifully styled letter, and can approve them. Notifications via email + on-site badges.

## Architecture

Single Express.js server serving everything:

- **Frontend:** Vanilla HTML/CSS/JS in `/public` (no build step)
- **Backend:** Express + better-sqlite3
- **Email:** Nodemailer (SMTP — Gmail app password or Resend)
- **Deploy:** Single app on Railway/Render

```
Express Server
├── /public          (static frontend)
│   ├── index.html   (landing / login)
│   ├── dashboard.html (wife's view)
│   ├── requests.html  (sahil's view)
│   └── letter.html    (single request view)
├── /api
│   ├── POST /api/auth/login      (send magic link)
│   ├── GET  /api/auth/verify     (verify magic link token)
│   ├── GET  /api/requests        (list requests)
│   ├── POST /api/requests        (create request)
│   ├── PATCH /api/requests/:id   (approve/reject)
│   └── GET  /api/notifications   (unread count)
└── SQLite DB file
```

## Users & Auth

Two hardcoded users (no signup):
- **Sahil** (role: requester) — can create requests, view status
- **Wife** (role: approver) — can view requests, approve/reject

**Magic link flow:**
1. User enters email on login page
2. Server generates token, stores in `magic_links` table (expires in 15 min)
3. Email sent with link: `https://site.com/api/auth/verify?token=xxx`
4. On click, server validates token, sets HTTP-only session cookie
5. Redirects to appropriate dashboard based on role

## Data Model

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('requester', 'approver'))
);

CREATE TABLE requests (
  id INTEGER PRIMARY KEY,
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME,
  seen INTEGER DEFAULT 0
);

CREATE TABLE magic_links (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0
);
```

## The Letter Template

When wife opens a request, she sees this styled as a handwritten letter:

```
Hi my cute wife,
I need ₹{amount} for {reason}.
So can you send it to me so I can fulfil our dreams with it.
Please find attached texts and approve it.

AMT- ₹{amount}
REASON- {reason}

I will always love you till eternity.

Ur husband
Sahil dino
```

## UI/UX Design

**Aesthetic:** Fun and quirky — bold colors, playful animations, cheeky humor.

- Bright gradients (purple/pink/orange)
- Bouncy animations on load
- Rounded cards with shadows
- Playful fonts (e.g., Poppins for body, a handwritten font for the letter)
- Confetti explosion when wife taps "Approve"
- Emoji accents in notifications

**Pages:**
1. **Login** — minimal, email input + "Send Magic Link" button
2. **Sahil's Dashboard** — "New Request" form + list of past requests with status chips
3. **Wife's Dashboard** — list of requests with unread badge, status filters
4. **Letter View** — the request displayed as the cute letter template, with Approve/Reject buttons at bottom

## Notifications

**On new request (to wife):**
- Email: Subject "Sahil dino has a new request for you!", body includes amount + link
- On-site: unread badge counter on dashboard

**On approval (to sahil):**
- Email: Subject "Your request for ₹{amount} was approved!", confirmation message
- On-site: status updates to "Approved" with green chip

## Tech Stack

- Node.js + Express
- better-sqlite3
- Nodemailer
- express-session (cookie-based sessions)
- No frontend framework — vanilla JS with fetch API
- CSS: custom, no framework (for that unique quirky feel)

## Deployment

- Single Railway or Render web service
- Environment variables: SMTP credentials, session secret, site URL
- SQLite file persists on disk (Railway/Render both support this)

## Future Possibilities (not in v1)

- WhatsApp notifications via CallMeBot
- Attachment/screenshot upload
- Request history analytics
- Dark mode toggle
