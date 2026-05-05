'use strict';

const { pool } = require('../db');
const { uuidv7 } = require('uuidv7');
const fetch = global.fetch;

const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} = require('./token.service');

async function exchangeCodeForToken(code, code_verifier) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier,
    }),
  });

  const data = await res.json();
  return data.access_token;
}

async function fetchGitHubUser(accessToken) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.json();
}

async function upsertUser(githubUser) {
  const existing = await pool.query(
    'SELECT * FROM users WHERE github_id = $1',
    [githubUser.id]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users
       SET username=$1, avatar_url=$2, last_login_at=$3
       WHERE github_id=$4`,
      [
        githubUser.login,
        githubUser.avatar_url,
        new Date(),
        githubUser.id,
      ]
    );

    return existing.rows[0];
  }

  const newUser = await pool.query(
    `INSERT INTO users (id, github_id, username, avatar_url, created_at)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      uuidv7(),
      githubUser.id,
      githubUser.login,
      githubUser.avatar_url,
      new Date(),
    ]
  );

  return newUser.rows[0];
}

async function issueTokens(user) {
  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refreshToken = generateRefreshToken();
  const hashed = hashToken(refreshToken);

  await pool.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      uuidv7(),
      user.id,
      hashed,
      new Date(Date.now() + 5 * 60 * 1000),
      new Date(),
    ]
  );

  return { accessToken, refreshToken };
}

async function refreshTokens(oldToken) {
  const hashed = hashToken(oldToken);

  const result = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash=$1',
    [hashed]
  );

  if (result.rows.length === 0) throw new Error('Invalid refresh token');

  const tokenRow = result.rows[0];

  // delete old token (rotation)
  await pool.query('DELETE FROM refresh_tokens WHERE id=$1', [tokenRow.id]);

  const user = await pool.query('SELECT * FROM users WHERE id=$1', [
    tokenRow.user_id,
  ]);

  return issueTokens(user.rows[0]);
}

module.exports = {
  exchangeCodeForToken,
  fetchGitHubUser,
  upsertUser,
  issueTokens,
  refreshTokens,
};