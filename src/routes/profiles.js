'use strict';

const express = require('express');
const { v7: uuidv7 } = require('uuid');
const { pool } = require('../db');
const { enrichName } = require('../services/enrichment');

const router = express.Router();

/** Full profile shape (single-record responses) */
function formatProfile(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    gender_probability: parseFloat(row.gender_probability),
    sample_size: parseInt(row.sample_size, 10),
    age: parseInt(row.age, 10),
    age_group: row.age_group,
    country_id: row.country_id,
    country_probability: parseFloat(row.country_probability),
    created_at: new Date(row.created_at).toISOString(),
  };
}

/** Slim profile shape (list responses) */
function formatProfileList(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    age: parseInt(row.age, 10),
    age_group: row.age_group,
    country_id: row.country_id,
  };
}

/* POST /api/profiles */
router.post('/', async (req, res) => {
  const { name } = req.body;

  // 400 – missing / empty
  if (name === undefined || name === null || name === '') {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  // 422 – wrong type
  if (typeof name !== 'string') {
    return res
      .status(422)
      .json({ status: 'error', message: 'Name must be a string' });
  }

  if (name.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Name cannot be empty' });
  }

  const normalizedName = name.trim().toLowerCase();

  try {
    // Idempotency check
    const existing = await pool.query(
      'SELECT * FROM profiles WHERE LOWER(name) = $1',
      [normalizedName]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: formatProfile(existing.rows[0]),
      });
    }

    // Enrich via external APIs
    const enriched = await enrichName(normalizedName);

    // Persist
    const id = uuidv7();
    const created_at = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO profiles
         (id, name, gender, gender_probability, sample_size,
          age, age_group, country_id, country_probability, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        id,
        normalizedName,
        enriched.gender,
        enriched.gender_probability,
        enriched.sample_size,
        enriched.age,
        enriched.age_group,
        enriched.country_id,
        enriched.country_probability,
        created_at,
      ]
    );

    return res.status(201).json({
      status: 'success',
      data: formatProfile(result.rows[0]),
    });
  } catch (err) {
    if (err.statusCode === 502) {
      return res
        .status(502)
        .json({ status: '502', message: `${err.api} returned an invalid response` });
    }
    console.error('[POST /api/profiles]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

/* GET /api/profiles */
router.get('/', async (req, res) => {
  const { gender, country_id, age_group } = req.query;

  let query = 'SELECT * FROM profiles WHERE 1=1';
  const params = [];

  if (gender) {
    params.push(gender.toLowerCase());
    query += ` AND LOWER(gender) = $${params.length}`;
  }

  if (country_id) {
    params.push(country_id.toUpperCase());
    query += ` AND UPPER(country_id) = $${params.length}`;
  }

  if (age_group) {
    params.push(age_group.toLowerCase());
    query += ` AND LOWER(age_group) = $${params.length}`;
  }

  query += ' ORDER BY created_at DESC';

  try {
    const result = await pool.query(query, params);
    return res.status(200).json({
      status: 'success',
      count: result.rows.length,
      data: result.rows.map(formatProfileList),
    });
  } catch (err) {
    console.error('[GET /api/profiles]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM profiles WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    return res.status(200).json({
      status: 'success',
      data: formatProfile(result.rows[0]),
    });
  } catch (err) {
    console.error('[GET /api/profiles/:id]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM profiles WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('[DELETE /api/profiles/:id]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

module.exports = router;
