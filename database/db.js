const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'employee', 'user')),
      qr_code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      visits_per_week INTEGER,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS user_memberships (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      membership_id INTEGER NOT NULL REFERENCES memberships(id),
      start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_membership_id INTEGER REFERENCES user_memberships(id),
      registered_by INTEGER REFERENCES users(id),
      visited_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      sold_by INTEGER NOT NULL REFERENCES users(id),
      item_type TEXT NOT NULL DEFAULT 'product' CHECK(item_type IN ('product', 'membership')),
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      total INTEGER NOT NULL,
      client_id INTEGER REFERENCES users(id),
      sold_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_qr_code ON users(qr_code);
    CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON user_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_memberships_status ON user_memberships(status);
    CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id);
    CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
    CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
  `);

  console.log('✅ Database initialized successfully');
}

// Helper: get active membership for a user
async function getActiveMembership(userId) {
  const result = await pool.query(`
    SELECT um.*, m.name as membership_name, m.price, m.duration_days, m.visits_per_week, m.description
    FROM user_memberships um
    JOIN memberships m ON m.id = um.membership_id
    WHERE um.user_id = $1 AND um.status = 'active' AND um.end_date > NOW()
    ORDER BY um.created_at DESC
    LIMIT 1
  `, [userId]);
  return result.rows[0] || null;
}

// Helper: count weekly visits (Mon–Sun) accurately
async function getWeeklyVisitsAccurate(userId, userMembershipId) {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM visits
    WHERE user_id = $1
      AND user_membership_id = $2
      AND DATE(visited_at) >= DATE_TRUNC('week', NOW())
      AND DATE(visited_at) <= (DATE_TRUNC('week', NOW()) + INTERVAL '6 days')
  `, [userId, userMembershipId]);
  return parseInt(result.rows[0]?.count || 0);
}

module.exports = { pool, initializeDatabase, getActiveMembership, getWeeklyVisitsAccurate };
