require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const { sendError } = require('../shared/http/responses');
const { buildCorsOptions } = require('../shared/http/cors');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'http://localhost:3002';
const PATIENT_REG_SERVICE_URL = process.env.PATIENT_REG_SERVICE_URL || 'http://localhost:3003';
const DIAGNOSTICS_VITALS_SERVICE_URL = process.env.DIAGNOSTICS_VITALS_SERVICE_URL || 'http://localhost:3004';
const GATEWAY_PORT = process.env.GATEWAY_PORT || process.env.PORT || 3000;

const app = express();

function forwardParsedJsonBody(proxyReq, req) {
  if (!req.body || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  if (typeof req.body !== 'object') return;

  const bodyData = JSON.stringify(req.body);
  if (!bodyData || bodyData === '{}') return;

  proxyReq.setHeader('Content-Type', 'application/json');
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
}

app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) return next();
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) return next();
  express.urlencoded({ extended: true })(req, res, next);
});

app.get('/ping', (req, res) => {
  res.status(200).json({ ok: true, service: 'api-gateway' });
});

const PING_MS = 1500;
app.get('/health', async (req, res) => {
  const [authOk, mainOk, patientRegOk, diagnosticsVitalsOk] = await Promise.all([
    ping(AUTH_SERVICE_URL, PING_MS),
    ping(MAIN_SERVICE_URL, PING_MS),
    ping(PATIENT_REG_SERVICE_URL, PING_MS),
    ping(DIAGNOSTICS_VITALS_SERVICE_URL, PING_MS),
  ]);
  res.status(200).json({
    success: true,
    service: 'api-gateway',
    message: 'Gateway is running',
    timestamp: new Date().toISOString(),
    backends: {
      auth: authOk ? 'up' : 'down',
      main: mainOk ? 'up' : 'down',
      patientRegistration: patientRegOk ? 'up' : 'down',
      diagnosticsVitals: diagnosticsVitalsOk ? 'up' : 'down',
    },
  });
});
// Proxy diagnostics and vitals endpoints
// Proxy diagnostics endpoints (strip /api/diagnostics prefix so service sees /...)
app.use(
  '/api/diagnostics',
  createProxyMiddleware({
    target: DIAGNOSTICS_VITALS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => path.replace(/^\/api\/diagnostics/, '') || '/',
    on: {
      proxyReq(proxyReq, req) {
        forwardParsedJsonBody(proxyReq, req);
      },
      error(err, req, res) {
        console.error('[Gateway] Diagnostics proxy error:', err.message);
        return sendError(res, 502, 'BAD_GATEWAY', 'Diagnostics&Vitals service unavailable');
      },
    },
  })
);

// Proxy vitals endpoints (forward /api/vitals/* as-is to service)
app.use(
  '/api/vitals',
  createProxyMiddleware({
    target: DIAGNOSTICS_VITALS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => path, // keep path as-is so /api/vitals/... hits service route
    on: {
      proxyReq(proxyReq, req) {
        forwardParsedJsonBody(proxyReq, req);
      },
      error(err, req, res) {
        console.error('[Gateway] Vitals proxy error:', err.message);
        return sendError(res, 502, 'BAD_GATEWAY', 'Diagnostics&Vitals service unavailable');
      },
    },
  })
);

function ping(baseUrl, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const url = new URL('/health', baseUrl);
    const lib = url.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        timeout: timeoutMs,
      },
      (res) => resolve(res.statusCode >= 200 && res.statusCode < 400)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

app.use(
  '/api/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    // Express mount strips /api/auth; add it back for auth-service routes.
    pathRewrite: (path) => (path.startsWith('/api/auth') ? path : `/api/auth${path}`),
    proxyTimeout: 10000,
    on: {
      proxyReq(proxyReq, req) {
        if (req.headers['content-type']) proxyReq.setHeader('Content-Type', req.headers['content-type']);
      },
      error(err, req, res) {
        console.error('[Gateway] Auth proxy error:', err.message);
        return sendError(res, 502, 'BAD_GATEWAY', 'Auth service unavailable');
      },
    },
  })
);

app.use(
  '/api/patients',
  createProxyMiddleware({
    target: PATIENT_REG_SERVICE_URL,
    changeOrigin: true,
    // Express mount strips /api/patients; add it back for patient-registration routes.
    pathRewrite: (path) => (path.startsWith('/api/patients') ? path : `/api/patients${path}`),
    on: {
      proxyReq(proxyReq, req) {
        forwardParsedJsonBody(proxyReq, req);
      },
      error(err, req, res) {
        console.error('[Gateway] Patient proxy error:', err.message);
        return sendError(res, 502, 'BAD_GATEWAY', 'Patient registration service unavailable');
      },
    },
  })
);

app.use(
  '/api',
  createProxyMiddleware({
    target: MAIN_SERVICE_URL,
    changeOrigin: true,
    // Express mount strips /api; add it back for main API routes.
    pathRewrite: (path) => (path.startsWith('/api') ? path : `/api${path}`),
    on: {
      proxyReq(proxyReq, req) {
        forwardParsedJsonBody(proxyReq, req);
      },
      error(err, req, res) {
        console.error('[Gateway] Main API proxy error:', err.message);
        return sendError(res, 502, 'BAD_GATEWAY', 'Main API unavailable');
      },
    },
  })
);

app.use('/', (req, res) => {
  return sendError(res, 404, 'NOT_FOUND', 'Route not found');
});

app.listen(GATEWAY_PORT, () => {
  console.log(
    `[Gateway] Running on port ${GATEWAY_PORT} | Auth → ${AUTH_SERVICE_URL} | Main API → ${MAIN_SERVICE_URL} | Patient Registration → ${PATIENT_REG_SERVICE_URL} | Diagnostics/Vitals → ${DIAGNOSTICS_VITALS_SERVICE_URL}`
  );
});

module.exports = app;
