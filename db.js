const { neon } = require('@neondatabase/serverless');

let sql;

function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

async function initDb() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('requester', 'approver'))
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TIMESTAMP DEFAULT NOW(),
      approved_at TIMESTAMP,
      seen INTEGER DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS magic_links (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used INTEGER DEFAULT 0
    )
  `;

  const users = await sql`SELECT COUNT(*) as count FROM users`;
  if (parseInt(users[0].count) === 0) {
    const sahilEmail = process.env.SAHIL_EMAIL || 'sahil@example.com';
    const wifeEmail = process.env.WIFE_EMAIL || 'wife@example.com';
    await sql`INSERT INTO users (name, email, role) VALUES ('Sahil dino', ${sahilEmail}, 'requester')`;
    if (wifeEmail !== sahilEmail) {
      await sql`INSERT INTO users (name, email, role) VALUES ('Wife', ${wifeEmail}, 'approver')`;
    }
  }
}

module.exports = { initDb, getDb };
