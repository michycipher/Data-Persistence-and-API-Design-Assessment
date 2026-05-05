'use strict';

const rateLimit = require('express-rate-limit');

/* Auth limiter */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    status: 'error',
    message: 'Too many requests, try again later',
  },
});

/* General limiter */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  // keyGenerator: (req) => {
  //   return req.user?.id || req.ip;
  // },
  message: {
    status: 'error',
    message: 'Too many requests, try again later',
  },
});

module.exports = { authLimiter, apiLimiter };