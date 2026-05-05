'use strict';

require('dotenv').config();
const { pool } = require('../db');

async function makeAdmin() {
  const username = process.argv[2];

  if (!username) {
    console.log('Usage: node makeAdmin.js <github_username>');
    process.exit(1);
  }

  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE username = $2 RETURNING id, username, role',
      ['admin', username]
    );

    if (result.rows.length === 0) {
      console.log('User not found');
    } else {
      console.log('Updated user:', result.rows[0]);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

makeAdmin();