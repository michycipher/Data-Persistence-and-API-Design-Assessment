'use strict';

require('dotenv').config();

const path = require('path');
const fs   = require('fs');
const { Pool } = require('pg');
const { uuidv7 } = require('uuidv7');
const { getCountryName } = require('./services/countries');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function classifyAgeGroup(age) {
  if (age <= 12) return 'child';
  if (age <= 19) return 'teenager';
  if (age <= 59) return 'adult';
  return 'senior';
}

async function seed() {
  const filePath = path.join(__dirname, '..', 'data', 'profiles.json');

  if (!fs.existsSync(filePath)) {
    console.error('  data/profiles.json not found.');
    console.error('    Download the seed file from the task link and place it at data/profiles.json');
    process.exit(1);
  }

  const raw    = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  // Handle both formats: plain array OR { "profiles": [...] }
  const profiles = Array.isArray(parsed)
    ? parsed
    : (parsed.profiles || parsed.data || Object.values(parsed)[0]);

  if (!Array.isArray(profiles)) {
    console.error(' Could not find profiles array in profiles.json');
    process.exit(1);
  }

  console.log(` Found ${profiles.length} profiles. Seeding...`);

  // Ensure table exists
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

  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name VARCHAR(255)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender     ON profiles(gender)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age_group  ON profiles(age_group)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_id ON profiles(country_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age        ON profiles(age)`);

  let inserted = 0;
  let skipped  = 0;

  for (const p of profiles) {
    // Support both flat and nested JSON structures
    const name    = (p.name || '').toLowerCase().trim();
    const gender  = p.gender || null;
    const age     = p.age    != null ? parseInt(p.age, 10) : null;
    const countryId = p.country_id || (p.country && p.country.country_id) || null;

    if (!name) { skipped++; continue; }

    const id           = p.id || uuidv7();
    const age_group    = p.age_group || (age != null ? classifyAgeGroup(age) : null);
    const country_name = p.country_name || getCountryName(countryId) || null;
    const created_at   = p.created_at  || new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO profiles
         (id, name, gender, gender_probability, sample_size,
          age, age_group, country_id, country_name, country_probability, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (name) DO NOTHING
       RETURNING id`,
      [
        id, name,
        gender,
        p.gender_probability != null ? parseFloat(p.gender_probability) : null,
        p.sample_size        != null ? parseInt(p.sample_size, 10)       : null,
        age, age_group,
        countryId, country_name,
        p.country_probability != null ? parseFloat(p.country_probability) : null,
        created_at,
      ]
    );

    if (result.rows.length > 0) inserted++;
    else skipped++;
  }

  console.log(` Done. Inserted: ${inserted} | Skipped (duplicates): ${skipped}`);
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
