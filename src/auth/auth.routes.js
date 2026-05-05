'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./auth.controller');

/* =========================
   OAUTH FLOW
========================= */
router.get('/github', controller.githubAuth);

// Browser OAuth callback (GitHub redirect)
router.get('/github/callback', controller.githubCallback);

// CLI OAuth callback (POST from CLI)
router.post('/github/callback', controller.githubCliCallback);

/* =========================
   TOKEN MANAGEMENT
========================= */
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

module.exports = router;