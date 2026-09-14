// backend/src/app.js
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//
// ⛔ FROZEN. Every route mount for every planned module is already here.
// If you need a new endpoint, add it inside your own module's routes file.
// If you genuinely need a new mount, message Vishwajeet — do not edit this.

import express from 'express';
import cors from 'cors';

// --- existing ---
import authRoutes from './modules/auth/auth.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import universitiesRoutes from './modules/university/university.routes.js';
import academicRoutes from './modules/academic/academic.routes.js';

// --- new: NEERAJ owns these files ---
import userRoutes from './modules/user/user.routes.js';
import socialRoutes from './modules/social/social.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';

// --- new: VISHWAJEET owns these files ---
import postsRoutes from './modules/posts/posts.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────
// CORS (Cross-Origin Resource Sharing) is the browser rule that decides when a
// page served from origin A is allowed to READ the response to a request it
// makes to origin B. The browser sends the request either way; the
// `Access-Control-Allow-Origin` header on our response is what tells it
// whether the calling page may see the reply.
//
// ⛔ This used to return the literal '*' in production, which tells every
// browser on earth that ANY website may call this API and read the result.
// That means a page the student has never heard of can drive our endpoints
// from their browser and read back the data, and it undoes part of the
// Turnstile and rate-limiting work from Phase 2 by making every route
// trivially scriptable from any origin. It also makes the API a permanent
// open CDN for our data. Do NOT put '*' back for convenience — if a legitimate
// client is being refused, add its exact origin to ALLOWED_ORIGINS below.
//
// Origins are matched as EXACT strings. An origin is scheme + host + port and
// nothing more, so no trailing slash, no path, no wildcard, no regex:
// 'https://example.com/' and 'https://example.com:443' both FAIL to match
// 'https://example.com'.
const isProduction = process.env.NODE_ENV === 'production';

const PRODUCTION_ORIGINS = [
    'https://yahora.netlify.app',
];

// Vite dev server. Development only — never merged in when NODE_ENV=production.
//
// ⚠ 3000 is THIS repo's actual dev port, not 5173: vite.config.js defaults
// VITE_DEV_PORT to 3000 with strictPort on, and frontend/.env sets 3000. 5173
// is Vite's stock default and is kept only in case someone runs with it. If a
// developer sets a per-developer port (two people on one machine must), their
// origin goes in WEB_ORIGINS rather than here.
const DEVELOPMENT_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

// ── LAN origins: DEVELOPMENT ONLY ─────────────────────────────────────────
// Consulted only when isProduction is false (see corsOrigin). backend/CLAUDE.md
// documents this as load-bearing: a phone and a second laptop on the same Wi-Fi
// must reach the dev server, which is how the Expo app gets tested. Their Origin
// is an RFC-1918 address on whatever port Expo or Vite picked, so an exact-string
// list cannot express it — hence a hostname test, ports deliberately ignored.
//
// This must NEVER be reachable in production: a private-range Origin there would
// be a browser on the server's own network, which is not a client we serve.

// RFC 1918 ranges: 10/8, 192.168/16, 172.16/12. Anchored, so "10.0.0.1.evil.com"
// does not match.
const PRIVATE_IPV4 =
    /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/** True for an origin served from this machine or another box on the LAN. */
function isLocalNetworkOrigin(origin) {
    let hostname;
    try {
        ({ hostname } = new URL(origin));
    } catch {
        return false; // Unparseable Origin header — not ours.
    }
    // .hostname keeps IPv6 literals bracketed ("[::1]"); strip to match the set.
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return LOOPBACK_HOSTNAMES.has(host) || PRIVATE_IPV4.test(host);
}

/**
 * Optional comma-separated override, e.g.
 *   WEB_ORIGINS=https://yahora.netlify.app,https://www.yahora.com
 * so the production allowlist can be corrected on the deploy without waiting
 * for a code change. Remove this if you would rather it live only in code.
 */
const ENV_ORIGINS = (process.env.WEB_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const ALLOWED_ORIGINS = [
    ...PRODUCTION_ORIGINS,
    ...ENV_ORIGINS,
    ...(isProduction ? [] : DEVELOPMENT_ORIGINS),
];

function corsOrigin(origin, callback) {
    // ⚠ ESSENTIAL — do not remove. Requests from the Expo app, from Postman and
    // from curl carry no Origin header, because CORS is a browser mechanism and
    // they are not browsers: there is no calling page whose access we would be
    // restricting, so refusing them protects nothing and breaks the mobile app
    // completely. They are protected by the auth token instead.
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

    // Development only — never consulted when NODE_ENV=production.
    if (!isProduction && isLocalNetworkOrigin(origin)) return callback(null, true);

    // Refuse by omitting the CORS headers, not by throwing. `false` here means
    // the response simply carries no Access-Control-Allow-Origin, so the browser
    // blocks the calling page from reading it — exactly as strong as an Error,
    // which only added a 500 and a stack trace per bot that found us.
    return callback(null, false);
}

app.use(cors({
    origin: corsOrigin,
    credentials: true,
    // X-Device-Id is sent by the OTP rate limiter. It is not a CORS-safelisted
    // header, so leaving it out makes every request-otp preflight fail.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'],
}));
app.use(express.json());

// A simple health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Success', message: 'Yahora backend is up and running! 🚀...' });
});

app.get('/', (req, res) => {
    res.send('Yahora API is successfully running! 🚀...');
});

// --- existing ---
app.use('/api/auth',          authRoutes);
app.use('/api/products',      productsRoutes);
app.use('/api/messages',      messagesRoutes);
app.use('/api/universities',  universitiesRoutes);
app.use('/api/academic',      academicRoutes);

// Legacy singular mount, pre-dating this plan. The four existing user
// endpoints (dashboard, profile, avatar, public) are live at /api/user
// in both web and mobile, so this stays. New work uses /api/users below.
app.use('/api/user',          userRoutes);

// --- new: NEERAJ owns these files ---
app.use('/api/users',         userRoutes);          // usernames, search
app.use('/api/users',         socialRoutes);        // follows, blocks, privacy
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports',       reportsRoutes);

// --- new: VISHWAJEET owns these files ---
app.use('/api/posts',         postsRoutes);
app.use('/api/admin',         adminRoutes);

export default app;
