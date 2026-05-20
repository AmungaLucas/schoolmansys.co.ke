/**
 * SchoolManSys Callback API Server
 *
 * Standalone Express.js server for handling M-Pesa Daraja callbacks
 * and other external webhooks. Runs on api.schoolmansys.co.ke
 *
 * Deployment: Phusion Passenger
 * Startup:    app.listen("passenger")
 */

const express = require('express');
const helmet = require('helmet');
const callbacksRouter = require('./src/routes/callbacks');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security Headers ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // Callbacks receive JSON from Safaricom
  crossOriginEmbedderPolicy: false,
}));

// ── Body Parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ───────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms ` +
      `- ${req.ip || req.connection?.remoteAddress}`
    );
  });
  next();
});

// ── Routes ────────────────────────────────────────────────────────

// Health check at root
app.get('/', (req, res) => {
  res.json({
    service: 'SchoolManSys Callback API',
    version: '1.0.0',
    endpoints: {
      'GET  /': 'This health check',
      'GET  /callbacks/mpesa': 'M-Pesa callback health check',
      'POST /callbacks/mpesa': 'M-Pesa Daraja STK Push callback',
    },
    timestamp: new Date().toISOString(),
  });
});

// M-Pesa callbacks
app.use('/callbacks', callbacksRouter);

// ── 404 Handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// ── Error Handler ─────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});

// ── Start Server ──────────────────────────────────────────────────
// Passenger passes "passenger" string as the port
const listenPort = typeof PORT === 'string' && PORT === 'passenger' ? 'passenger' : PORT;

app.listen(listenPort, () => {
  console.log(`SchoolManSys Callback API running on port ${listenPort}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
