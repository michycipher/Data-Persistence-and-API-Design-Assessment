'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

async function initDB() {
  // change the schema as needed for stages 2
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id                    VARCHAR(36)    PRIMARY KEY,
      name                  VARCHAR(255)   UNIQUE NOT NULL,
      gender                VARCHAR(50),
      gender_probability    NUMERIC(6,4),
      sample_size           INTEGER,
      age                   INTEGER,
      age_group             VARCHAR(20),
      country_id            VARCHAR(10),
      country_name          VARCHAR(255),
      country_probability   NUMERIC(6,4),
      created_at            TIMESTAMPTZ    NOT NULL
    )
  `);

  // Add country_name column if upgrading from Stage 1 (safe migration)
  await pool.query(`
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name VARCHAR(255)
  `);

  // Indexes for fast filtering — no full table scans
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender      ON profiles(gender)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age_group   ON profiles(age_group)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_id  ON profiles(country_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age         ON profiles(age)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_created_at  ON profiles(created_at)`);

   // USERS TABLE
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      github_id VARCHAR UNIQUE NOT NULL,
      username VARCHAR,
      email VARCHAR,
      avatar_url VARCHAR,
      role VARCHAR DEFAULT 'analyst',
      is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  // REFRESH TOKENS TABLE
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  console.log('Database ready.');
}

module.exports = { pool, initDB };
