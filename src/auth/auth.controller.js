'use strict';

const crypto = require('crypto');
const {
  exchangeCodeForToken,
  fetchGitHubUser,
  upsertUser,
  issueTokens,
  refreshTokens,
} = require('./auth.service');

const store = new Map();

/* =========================
   PKCE GENERATION
========================= */
function generatePKCE() {
  const code_verifier = crypto.randomBytes(32).toString('hex');

  const code_challenge = crypto
    .createHash('sha256')
    .update(code_verifier)
    .digest('base64url');

  return { code_verifier, code_challenge };
}

/* =========================
   STEP 1: REDIRECT USER TO GITHUB
   (CLI OR WEB)
========================= */
exports.githubAuth = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const { code_verifier, code_challenge } = generatePKCE();

  store.set(state, { code_verifier });

  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${process.env.GITHUB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&scope=read:user user:email` +
    `&code_challenge=${code_challenge}` +
    `&code_challenge_method=S256`;

  return res.redirect(url);
};

/* =========================
   STEP 2: GITHUB CALLBACK (BROWSER REDIRECT)
========================= */
exports.githubCallback = async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing code or state',
    });
  }

  if (!store.has(state)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid or expired state',
    });
  }

  const { code_verifier } = store.get(state);
  store.delete(state);

  try {
    const ghToken = await exchangeCodeForToken(code, code_verifier);

    const ghUser = await fetchGitHubUser(ghToken);

    const user = await upsertUser(ghUser);

    const tokens = await issueTokens(user);

    return res.json({
      status: 'success',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user,
    });
  } catch (err) {
    console.error('[GitHub Callback Error]', err.response?.data || err.message);

    return res.status(500).json({
      status: 'error',
      message: 'Authentication failed',
    });
  }
};

/* =========================
   STEP 3: CLI CALLBACK SUPPORT (IMPORTANT FIX)
   (THIS FIXES YOUR 404 ISSUE)
========================= */
exports.githubCliCallback = async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body;

  if (!code) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing code',
    });
  }

  try {
    const ghToken = await exchangeCodeForToken(
      code,
      code_verifier,
      redirect_uri
    );

    const ghUser = await fetchGitHubUser(ghToken);

    const user = await upsertUser(ghUser);

    const tokens = await issueTokens(user);

    return res.json({
      status: 'success',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user,
    });
  } catch (err) {
    console.error('[CLI Callback Error]', err.response?.data || err.message);

    return res.status(500).json({
      status: 'error',
      message: 'CLI authentication failed',
    });
  }
};

/* =========================
   REFRESH TOKEN
========================= */
exports.refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    const tokens = await refreshTokens(refresh_token);

    return res.json({
      status: 'success',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  } catch {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid refresh token',
    });
  }
};

/* =========================
   LOGOUT
========================= */
exports.logout = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    const { pool } = require('../db');
    const { hashToken } = require('./token.service');

    const hashed = hashToken(refresh_token);

    await pool.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [
      hashed,
    ]);

    return res.json({ status: 'success' });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Logout failed',
    });
  }
};