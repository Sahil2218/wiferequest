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
