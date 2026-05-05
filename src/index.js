'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { initDB } = require('./db');

const profileRoutes = require('./routes/profiles');
const authRoutes = require('./auth/auth.routes');
const adminRoutes = require('./routes/admin');

const { authenticate } = require('./auth/auth.middleware');
const { logger } = require('./middleware/logger');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   GLOBAL MIDDLEWARE
========================= */
app.use(logger);

app.use(cors({
  origin: '*',
  credentials: true,
}));

app.use(express.json());

/* =========================
   HEALTH CHECK
========================= */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/* =========================
   AUTH ROUTES (RATE LIMITED)
========================= */
app.use('/auth', authLimiter, authRoutes);


/* =========================
   ADMIN ROUTES
========================= */
app.use('/admin', adminRoutes);

/* =========================
   PROTECTED API ROUTES
========================= */
app.use('/api', apiLimiter, authenticate);

/* Profiles */
app.use('/api/profiles', profileRoutes);

/* =========================
   404 HANDLER
========================= */
app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, _req, res, _next) => {
  console.error('[UNHANDLED ERROR]', err);

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
});

/* =========================
   START SERVER
========================= */
async function start() {
  try {
    await initDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();




// 'use strict';

// require('dotenv').config();

// const express = require('express');
// const cors = require('cors');

// const { initDB } = require('./db');
// const profileRoutes = require('./routes/profiles');
// const authRoutes = require('./auth/auth.routes');

// const { authenticate } = require('./auth/auth.middleware');
// const { logger } = require('./middleware/logger');
// const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

// const app = express();
// const PORT = process.env.PORT || 3000;

// /* Logger */
// app.use(logger);

// /* CORS */
// app.use(cors({ origin: '*' }));

// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
//   if (req.method === 'OPTIONS') return res.sendStatus(204);
//   next();
// });

// app.use(express.json());

// /* Auth routes (rate limited) */
// app.use('/auth', authLimiter, authRoutes);
// // app.use('/auth', require('./auth/auth.routes'));

// /* Protected API routes */
// app.use('/api', apiLimiter, authenticate);

// /* Profiles */
// app.use('/api/profiles', profileRoutes);

// /* Health */
// app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// /* 404 */
// app.use((_req, res) => {
//   res.status(404).json({ status: 'error', message: 'Route not found' });
// });

// /* Error */
// app.use((err, _req, res, _next) => {
//   console.error('Unhandled error:', err);
//   res.status(500).json({ status: 'error', message: 'Internal server error' });
// });

// /* Start */
// async function start() {
//   try {
//     await initDB();
//     app.listen(PORT, () => {
//       console.log(`Server running on port ${PORT}`);
//     });
//   } catch (err) {
//     console.error('Startup error:', err);
//     process.exit(1);
//   }
// }

// start();