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
