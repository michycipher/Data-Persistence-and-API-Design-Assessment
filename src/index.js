'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const profileRoutes = require('./routes/profiles');

const app = express();
const PORT = process.env.PORT || 3000;

/* Middleware */
app.use(cors({ origin: '*' }));

// Ensure Access-Control-Allow-Origin: * is always present (grading requirement)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

app.use('/api/profiles', profileRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

/* 404 fallback */
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

/* Global error handler */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

/* Boot */
async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`Profile Intelligence Service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
