const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id            VARCHAR(36)      PRIMARY KEY,
      name          VARCHAR(255)     UNIQUE NOT NULL,
      gender        VARCHAR(50),
      gender_probability  NUMERIC(6,4),
      sample_size   INTEGER,
      age           INTEGER,
      age_group     VARCHAR(20),
      country_id    VARCHAR(10),
      country_probability NUMERIC(6,4),
      created_at    TIMESTAMPTZ      NOT NULL
    )
  `);
  console.log('Database ready.');
}

module.exports = { pool, initDB };
