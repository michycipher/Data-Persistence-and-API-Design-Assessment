'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../auth/auth.middleware');
const { pool } = require('../db');

/**
 * ADMIN STATS
 */
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    const totalProfiles = await pool.query('SELECT COUNT(*) FROM profiles');

    const recent = await pool.query(
      'SELECT * FROM profiles ORDER BY created_at DESC LIMIT 5'
    );

    res.json({
      status: 'success',
      data: {
        users: Number(totalUsers.rows[0].count),
        profiles: Number(totalProfiles.rows[0].count),
        recent_profiles: recent.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch admin stats',
    });
  }
});

module.exports = router;