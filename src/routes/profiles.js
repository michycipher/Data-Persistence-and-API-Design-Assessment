'use strict';

const express = require('express');
const { uuidv7 } = require('uuidv7');
const { pool }   = require('../db');
const { enrichName } = require('../services/enrichment');
const { parseQuery } = require('../services/nlpParser');

const router = express.Router();

// ─── Whitelists (prevent SQL injection on dynamic clauses) ───────────────────
const VALID_SORT_FIELDS = ['age', 'created_at', 'gender_probability'];
const VALID_ORDERS      = ['asc', 'desc'];

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatProfile(row) {
  return {
    id:                  row.id,
    name:                row.name,
    gender:              row.gender,
    gender_probability:  parseFloat(row.gender_probability),
    age:                 parseInt(row.age, 10),
    age_group:           row.age_group,
    country_id:          row.country_id,
    country_name:        row.country_name || null,
    country_probability: parseFloat(row.country_probability),
    created_at:          new Date(row.created_at).toISOString(),
  };
}

function formatProfileFull(row) {
  const p = formatProfile(row);
  if (row.sample_size) p.sample_size = parseInt(row.sample_size, 10);
  return p;
}

// ─── Shared WHERE clause builder ─────────────────────────────────────────────
function buildWhereClause(filters) {
  const conditions = ['1=1'];
  const params     = [];

  const add = (condition, value) => {
    params.push(value);
    conditions.push(condition.replace('?', `$${params.length}`));
  };

  if (filters.gender)    add('LOWER(gender) = ?',    filters.gender.toLowerCase());
  if (filters.age_group) add('LOWER(age_group) = ?', filters.age_group.toLowerCase());
  if (filters.country_id) add('UPPER(country_id) = ?', filters.country_id.toUpperCase());
  if (filters.min_age    != null) add('age >= ?', parseInt(filters.min_age, 10));
  if (filters.max_age    != null) add('age <= ?', parseInt(filters.max_age, 10));
  if (filters.min_gender_probability  != null) add('gender_probability >= ?',  parseFloat(filters.min_gender_probability));
  if (filters.min_country_probability != null) add('country_probability >= ?', parseFloat(filters.min_country_probability));

  return { where: conditions.join(' AND '), params };
}

// ─── Param validation ────────────────────────────────────────────────────────
function validateListParams(q) {
  const numFields = ['min_age','max_age','min_gender_probability','min_country_probability','page','limit'];
  for (const f of numFields) {
    if (q[f] !== undefined && isNaN(Number(q[f]))) return 'Invalid query parameters';
  }
  if (q.sort_by && !VALID_SORT_FIELDS.includes(q.sort_by)) return 'Invalid query parameters';
  if (q.order   && !VALID_ORDERS.includes(q.order.toLowerCase())) return 'Invalid query parameters';
  return null;
}

// ─── POST /api/profiles ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (name === undefined || name === null || name === '')
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  if (typeof name !== 'string')
    return res.status(422).json({ status: 'error', message: 'Name must be a string' });
  if (name.trim() === '')
    return res.status(400).json({ status: 'error', message: 'Name cannot be empty' });

  const normalizedName = name.trim().toLowerCase();

  try {
    const existing = await pool.query(
      'SELECT * FROM profiles WHERE LOWER(name) = $1', [normalizedName]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json({
        status: 'success', message: 'Profile already exists',
        data: formatProfileFull(existing.rows[0]),
      });
    }

    const enriched   = await enrichName(normalizedName);
    const id         = uuidv7();
    const created_at = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO profiles
         (id, name, gender, gender_probability, sample_size,
          age, age_group, country_id, country_name, country_probability, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, normalizedName,
       enriched.gender, enriched.gender_probability, enriched.sample_size,
       enriched.age, enriched.age_group,
       enriched.country_id, enriched.country_name, enriched.country_probability,
       created_at]
    );

    return res.status(201).json({ status: 'success', data: formatProfileFull(result.rows[0]) });
  } catch (err) {
    if (err.statusCode === 502)
      return res.status(502).json({ status: '502', message: `${err.api} returned an invalid response` });
    console.error('[POST /api/profiles]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ─── GET /api/profiles/search  ← MUST be before /:id ─────────────────────────
router.get('/search', async (req, res) => {
  const { q, page, limit } = req.query;

  if (!q || q.trim() === '')
    return res.status(400).json({ status: 'error', message: 'Query parameter q is required' });

  const { filters, interpreted } = parseQuery(q);

  if (!interpreted)
    return res.status(400).json({ status: 'error', message: 'Unable to interpret query' });

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const offset   = (pageNum - 1) * limitNum;
  const { where, params } = buildWhereClause(filters);

  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM profiles WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limitNum, offset];
    const dataResult = await pool.query(
      `SELECT * FROM profiles WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return res.status(200).json({
      status: 'success', page: pageNum, limit: limitNum, total,
      data: dataResult.rows.map(formatProfile),
    });
  } catch (err) {
    console.error('[GET /api/profiles/search]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ─── GET /api/profiles ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const validationError = validateListParams(req.query);
  if (validationError)
    return res.status(400).json({ status: 'error', message: validationError });

  const {
    gender, age_group, country_id,
    min_age, max_age, min_gender_probability, min_country_probability,
    sort_by = 'created_at', order = 'desc', page = 1, limit = 10,
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const offset   = (pageNum - 1) * limitNum;
  const sortField = VALID_SORT_FIELDS.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = VALID_ORDERS.includes((order || '').toLowerCase()) ? order.toLowerCase() : 'desc';

  const { where, params } = buildWhereClause({
    gender, age_group, country_id,
    min_age, max_age, min_gender_probability, min_country_probability,
  });

  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM profiles WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limitNum, offset];
    const dataResult = await pool.query(
      `SELECT * FROM profiles WHERE ${where}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return res.status(200).json({
      status: 'success', page: pageNum, limit: limitNum, total,
      data: dataResult.rows.map(formatProfile),
    });
  } catch (err) {
    console.error('[GET /api/profiles]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ─── GET /api/profiles/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    return res.status(200).json({ status: 'success', data: formatProfileFull(result.rows[0]) });
  } catch (err) {
    console.error('[GET /api/profiles/:id]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ─── DELETE /api/profiles/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM profiles WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('[DELETE /api/profiles/:id]', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

module.exports = router;
