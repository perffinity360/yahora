#!/usr/bin/env node
// backend/scripts/diagnose-token.mjs
// ══════════════════════════════════════════════
// OWNER: VISHWAJEET   —   token-lifetime diagnosis
// ══════════════════════════════════════════════
//
// INVESTIGATION ONLY. This script reads, calls and reports. It never edits
// application code and never claims to fix anything. A failing call is the
// deliverable.
//
// SYMPTOM UNDER INVESTIGATION
//   GET /api/auth/password-status returns 401 UNAUTHORIZED with a token that
//   worked moments earlier.
//
// THE CENTRAL QUESTION, asked on every single step:
//   A) our backend   GET http://localhost:5000/api/auth/password-status
//   B) GoTrue direct GET http://127.0.0.1:54321/auth/v1/user
//
//   A fails + B succeeds  -> the token is VALID; our middleware or our shared
//                            supabase client is at fault (candidate 3)
//   A fails + B fails     -> the token is genuinely dead; S4/S7 say whether
//                            that is expiry or revocation
//
//   Both calls are made back to back with the SAME token string, so any
//   difference between them is a property of our backend, not of the token.
//
// Reference reading, in the order it mattered:
//   docs/PHASE_1_RUNBOOK.md §0.6          the settled auth design
//   docs/PHASE_1_RUNBOOK.md CC-5          the prompt that built these endpoints
//   docs/CHANGELOG.md 2026-08-12          the shared-client demotion outage
//   docs/CHANGELOG.md 2026-08-20 (CC-4)   "the token dies when onboarding succeeds"
//   backend/src/config/supabase.js        createSessionClient() and why it exists
//
//   node backend/scripts/diagnose-token.mjs             run the diagnosis
//   node backend/scripts/diagnose-token.mjs --cleanup   drop fixtures, exit
//
// Fixtures are rebuilt from scratch on every run and deliberately LEFT IN
// PLACE afterwards so a finding can be inspected in Studio.
//
// ⚠️ LOCAL STACK ONLY. Aborts unless DB_URL resolves to 127.0.0.1:54322.
//
// ── On reuse ────────────────────────────────────────────────────────────────
// The psql-with-docker-fallback helper and the Mailpit OTP reader below are
// taken VERBATIM from backend/scripts/verify-block-f.mjs — same code, same
// semantics, same container name. They are copied rather than imported for one
// reason: verify-block-f.mjs has no exports and calls main() at module scope,
// so importing it would run the whole Block F suite as a side effect. Adding an
// export guard there would mean modifying a file this task says not to touch.
// If these two ever diverge, verify-block-f.mjs is the original.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

const API     = 'http://localhost:5000';
const GOTRUE  = 'http://127.0.0.1:54321';
const DB_URL  = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const MAILPIT = 'http://127.0.0.1:54324';

const DB_CONTAINER = 'supabase_db_yahora';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const USER_1 = { email: 'blockg.diag@iiitk.ac.in',  username: 'blockgdiag2026',  label: 'U1' };
const USER_2 = { email: 'blockg.diag2@iiitk.ac.in', username: 'blockgdiag22026', label: 'U2' };
// S10 only. A third user so the fix test never runs against a fixture that
// S1–S9 have already onboarded, logged in as, or revoked sessions for.
const USER_3 = { email: 'blockg.diag3@iiitk.ac.in', username: 'blockgdiag32026', label: 'U3' };
const PASSWORD = 'blockgdiagpass123';
// The password S10b changes TO. Must differ from PASSWORD or set-password is a
// no-op change and GoTrue may not revoke, which would make S10b prove nothing.
const PASSWORD_2 = 'blockgdiagpass456';

const EMAIL_PREFIX = 'blockg.diag';

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold   = (s) => c('1', s);
const red    = (s) => c('31', s);
const green  = (s) => c('32', s);
const yellow = (s) => c('33', s);
const cyan   = (s) => c('36', s);
const dim    = (s) => c('2', s);

const log  = (...a) => console.log(...a);
const step = (s) => log(dim('  · ') + s);
const head = (s) => log('\n' + bold('── ' + s + ' ' + '─'.repeat(Math.max(0, 68 - s.length))));

/** Wall-clock stamp on every network line, so ordering is never in doubt. */
const stamp = () => new Date().toISOString().slice(11, 23);

/** Abort loudly. Nothing below this line is safe to keep running. */
function abort(reason, detail) {
    log('\n' + red(bold('ABORT: ' + reason)));
    if (detail) log(dim(String(detail)));
    log(red('Nothing was diagnosed. Fix the above and re-run.'));
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety: this harness deletes and inserts rows. It must never be pointed
// anywhere but the local stack.
//   (verbatim from verify-block-f.mjs)
// ─────────────────────────────────────────────────────────────────────────────

function assertLocalDatabase() {
    let url;
    try {
        url = new URL(DB_URL);
    } catch {
        abort('DB_URL is not a parseable URL.', DB_URL);
    }
    const hostOk = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    const portOk = url.port === '54322';
    if (!hostOk || !portOk) {
        abort(
            'DB_URL does not resolve to 127.0.0.1:54322 — refusing to run.',
            `host=${url.hostname} port=${url.port}\n` +
            'This script deletes and inserts rows. It is for the local stack only.',
        );
    }
    if (/supabase\.co/i.test(DB_URL) || /supabase\.co/i.test(API) || /supabase\.co/i.test(GOTRUE)) {
        abort('A *.supabase.co host appears in the configuration — refusing to run.');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL — shell out to psql, docker exec fallback
//   (verbatim from verify-block-f.mjs)
// ─────────────────────────────────────────────────────────────────────────────

const FS = ''; // ASCII unit separator: cannot appear in our data

let psqlMode = null; // 'native' | 'docker'

function detectPsql() {
    try {
        execFileSync('psql', ['--version'], { stdio: 'pipe' });
        psqlMode = 'native';
        return;
    } catch { /* not on PATH — fall through */ }

    try {
        execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-c', 'select 1'],
            { stdio: 'pipe' });
        psqlMode = 'docker';
        return;
    } catch {
        abort(
            'No psql available.',
            'psql is not on PATH and `docker exec ' + DB_CONTAINER + ' psql` failed.\n' +
            'Start the local stack with `supabase start`, or install the psql client.',
        );
    }
}

function psqlArgs(sqlText) {
    const common = ['-v', 'ON_ERROR_STOP=1', '-tA', '-F', FS, '-c', sqlText];
    return psqlMode === 'native'
        ? { bin: 'psql', args: [DB_URL, ...common] }
        : { bin: 'docker', args: ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', ...common] };
}

/** Run SQL. Returns an array of rows, each row an array of column strings. */
function sql(text) {
    const { bin, args } = psqlArgs(text);
    let out;
    try {
        out = execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        const stderr = (e.stderr || '').toString().trim();
        throw new Error(`psql failed:\n  SQL: ${text}\n  ${stderr || e.message}`);
    }
    const trimmed = out.replace(/\n+$/, '');
    if (trimmed === '') return [];
    return trimmed.split('\n').map((line) => line.split(FS));
}

/** First column of the first row, or null. */
function sqlOne(text) {
    const rows = sql(text);
    return rows.length ? rows[0][0] : null;
}

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// ─────────────────────────────────────────────────────────────────────────────
// The local anon key — needed for call B, because GoTrue rejects a request
// with no apikey before it ever looks at the bearer token, and a 401 for the
// wrong reason would corrupt the whole diagnosis.
//
// `supabase status -o json` is asked first because it is the ground truth for
// whatever stack is running right now. backend/.env is the fallback, read from
// THIS FILE's location rather than process.cwd() — the cwd-relative version of
// that bug is on the record in docs/CHANGELOG.md (2026-08-20, seedDemo.js).
//
// ⚠️ The .env parse strips a trailing `#` comment and surrounding whitespace.
// backend/.env really does carry `SUPABASE_ANON_KEY=sb_publishable_… #https://…`
// on one line, and a naive read hands GoTrue a key with a URL glued to it. That
// family of bug (trailing space / trailing junk in a .env URL) is already
// called out in frontend/CLAUDE.md §13.
// ─────────────────────────────────────────────────────────────────────────────

function anonKeyFromSupabaseStatus() {
    let out;
    try {
        out = execFileSync('supabase', ['status', '-o', 'json'],
            { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        // `supabase status` prints "Stopped services: [...]" to stderr and still
        // exits non-zero on a partially-up stack, but the JSON is on stdout.
        out = (e.stdout || '').toString();
    }
    const line = out.split('\n').find((l) => l.trim().startsWith('{'));
    if (!line) return null;
    try {
        const j = JSON.parse(line);
        return j.PUBLISHABLE_KEY || j.ANON_KEY || null;
    } catch {
        return null;
    }
}

function anonKeyFromEnv() {
    const envPath = path.join(REPO_ROOT, 'backend', '.env');
    let src;
    try {
        src = readFileSync(envPath, 'utf8');
    } catch {
        return null;
    }
    for (const line of src.split('\n')) {
        const m = line.match(/^\s*SUPABASE_ANON_KEY\s*=\s*(.*)$/);
        if (!m) continue;
        // Strip an inline comment, then quotes, then whitespace.
        const v = m[1].split('#')[0].trim().replace(/^["']|["']$/g, '').trim();
        if (v) return v;
    }
    return null;
}

function readAnonKey() {
    const fromStatus = anonKeyFromSupabaseStatus();
    if (fromStatus) {
        step(dim('    anon key source: `supabase status -o json`'));
        return fromStatus;
    }
    const fromEnv = anonKeyFromEnv();
    if (fromEnv) {
        step(dim('    anon key source: backend/.env (inline comment stripped)'));
        return fromEnv;
    }
    abort('Could not obtain a local anon/publishable key.',
        'Tried `supabase status -o json` and backend/.env SUPABASE_ANON_KEY.\n' +
        'Call B needs an apikey header, and without it GoTrue would 401 for the\n' +
        'wrong reason — which would corrupt the entire diagnosis.');
}

let ANON_KEY = null;

// ─────────────────────────────────────────────────────────────────────────────
// JWT — decoded LOCALLY, never sent anywhere. This exists so that "expired"
// can never be confused with "revoked": if exp is still in the future and the
// call fails anyway, expiry is off the table by arithmetic, not by argument.
// ─────────────────────────────────────────────────────────────────────────────

function decodeJwt(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64')
            .toString('utf8');
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/** Seconds until exp. Negative means already expired. */
function secondsToExpiry(token) {
    const p = decodeJwt(token);
    if (!p?.exp) return null;
    return p.exp - Math.floor(Date.now() / 1000);
}

function printJwt(label, token) {
    const p = decodeJwt(token);
    if (!p) {
        step(yellow('jwt ' + label + ': not decodable'));
        return;
    }
    const ttl = secondsToExpiry(token);
    const ttlText = ttl === null ? '?' : `${ttl}s`;
    step(
        dim('jwt ' + label + '  ') +
        `sub=${cyan(p.sub || '?')}  iat=${p.iat}  exp=${p.exp}  ` +
        (ttl !== null && ttl <= 0 ? red(`exp-now=${ttlText}  EXPIRED`) : green(`exp-now=${ttlText}`)) +
        dim(`  session_id=${p.session_id || 'none'}`),
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────────────────

async function http(method, url, { headers = {}, body } = {}) {
    const h = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';

    let res;
    try {
        res = await fetch(url, {
            method,
            headers: h,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (e) {
        return { status: 0, body: null, text: '', networkError: String(e) };
    }

    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { status: res.status, body: parsed, text };
}

const api = (method, pathname, { token, body } = {}) =>
    http(method, API + pathname, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
    });

const errorCode = (r) => {
    if (!r.body || typeof r.body !== 'object') return null;
    // Ours is { error, message }; GoTrue's is { error_code } or { code } or { msg }.
    return r.body.error ?? r.body.error_code ?? r.body.code ?? null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Which process is answering on :5000?
//
// This matters for S9 and nothing else. The demotion this script is hunting for
// lives in memory on ONE process and survives until that process restarts — and
// the backend is normally run under nodemon, which restarts on any file change.
// If the PID changes between S9a and S9c, a demoted client would be silently
// reset and S9 would report "no demotion" when the truth is "we lost the
// evidence". So the PID is captured either side and the S9 verdict is withheld
// if it moved.
// ─────────────────────────────────────────────────────────────────────────────

function backendPid() {
    try {
        const out = execFileSync('lsof', ['-nP', '-iTCP:5000', '-sTCP:LISTEN', '-t'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return out.trim().split('\n').filter(Boolean).join(',') || null;
    } catch {
        return null; // lsof missing or nothing listening — not fatal, just unknown
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO CALLS — always made as a pair, always in this order
// ─────────────────────────────────────────────────────────────────────────────

const ROWS = []; // the timestamped table printed at the end

function record(stepId, call, r, token, note) {
    const ttl = secondsToExpiry(token);
    ROWS.push({
        time:  stamp(),
        step:  stepId,
        call,
        status: r.status,
        code:  errorCode(r),
        ttl,
        note:  note || '',
    });
}

/** A) our backend. */
async function callA(stepId, token, note) {
    const r = await api('GET', '/api/auth/password-status', { token });
    record(stepId, 'A backend  /api/auth/password-status', r, token, note);
    const ok = r.status === 200;
    log(
        dim(`  ${stamp()} `) + bold(stepId.padEnd(4)) +
        ' A backend  ' + (ok ? green(String(r.status)) : red(String(r.status))) +
        dim('  ' + (errorCode(r) ?? '-')) +
        dim('  ttl=' + (secondsToExpiry(token) ?? '?') + 's') +
        dim('  ' + (r.text || '').slice(0, 90)),
    );
    return r;
}

/** B) GoTrue direct. Same token string, one hop earlier in the chain. */
async function callB(stepId, token, note) {
    const r = await http('GET', GOTRUE + '/auth/v1/user', {
        headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
    });
    record(stepId, 'B gotrue   /auth/v1/user', r, token, note);
    const ok = r.status === 200;
    log(
        dim(`  ${stamp()} `) + bold(stepId.padEnd(4)) +
        ' B gotrue   ' + (ok ? green(String(r.status)) : red(String(r.status))) +
        dim('  ' + (errorCode(r) ?? '-')) +
        dim('  ttl=' + (secondsToExpiry(token) ?? '?') + 's') +
        dim('  ' + (r.text || '').slice(0, 90)),
    );
    return r;
}

/** The pair, with the JWT decoded locally first. Never one without the other. */
async function pair(stepId, token, { label } = {}) {
    printJwt(label || stepId, token);
    const a = await callA(stepId, token);
    const b = await callB(stepId, token);
    return { a, b, verdict: verdictOf(a, b) };
}

function verdictOf(a, b) {
    if (a.status === 200 && b.status === 200) return 'both-ok';
    if (a.status !== 200 && b.status === 200) return 'backend-only';   // candidate 3
    if (a.status !== 200 && b.status !== 200) return 'token-dead';
    return 'gotrue-only';                                              // A ok, B not: odd
}

const VERDICT_TEXT = {
    'both-ok':      green('token accepted by both'),
    'backend-only': red(bold('A fails, B succeeds → TOKEN IS VALID, OUR BACKEND REJECTS IT')),
    'token-dead':   yellow('A and B both reject → the token itself is dead'),
    'gotrue-only':  yellow('A succeeds but B fails → inspect, this should not happen'),
};

// ─────────────────────────────────────────────────────────────────────────────
// S10 ASSERTIONS
//
// S1–S9 are a diagnosis: they observe and report, and a "bad" reading is the
// finding, not a failure. S10 is different — it is a REGRESSION TEST of the
// fix, so every check here either passes or the script exits non-zero.
// ─────────────────────────────────────────────────────────────────────────────

const S10 = [];

function check(id, desc, ok, detail) {
    S10.push({ id, desc, ok: !!ok, detail: detail || '' });
    log(
        dim('  · ') + (ok ? green('PASS') : red(bold('FAIL'))) + '  ' +
        bold(id.padEnd(9)) + desc + (detail ? dim('   ' + detail) : ''),
    );
    return !!ok;
}

/** The six assertions the brief names, run identically against both endpoints. */
async function assertSessionReplaced(prefix, label, response, oldToken) {
    const body = response.body;
    const newToken = body && typeof body === 'object'
        ? body.session?.access_token ?? null
        : null;

    check(prefix + 'a', `${label} returned 200`,
        response.status === 200,
        `status=${response.status} ${(response.text || '').slice(0, 120)}`);

    check(prefix + 'b', 'response contains session.access_token',
        typeof newToken === 'string' && newToken.length > 0,
        'top-level keys: ' + (body && typeof body === 'object'
            ? Object.keys(body).join(', ') : '(not an object)'));

    check(prefix + 'c', 'the new token DIFFERS from the caller\'s old one',
        !!newToken && newToken !== oldToken,
        newToken === oldToken ? 'identical string — nothing was minted' : '');

    if (!newToken) {
        check(prefix + 'd', 'NEW token accepted by our backend + GoTrue', false,
            'skipped — there is no new token to test');
        check(prefix + 'e', 'OLD token now dead at our backend + GoTrue', false,
            'skipped — the fix did not produce a session');
        return null;
    }

    // Does the replacement actually work — at BOTH hops, not just ours?
    log('');
    step(bold(prefix + '  NEW token'));
    const fresh = await pair(prefix + '-new', newToken, { label: 'NEW' });
    check(prefix + 'd', 'NEW token accepted by our backend (200) AND GoTrue (200)',
        fresh.a.status === 200 && fresh.b.status === 200,
        `backend=${fresh.a.status} gotrue=${fresh.b.status}`);

    // And is the old one still dead? The revocation must survive the fix —
    // other devices staying logged out is the property we are keeping.
    log('');
    step(bold(prefix + '  OLD token — revocation must still hold'));
    const stale = await pair(prefix + '-old', oldToken, { label: 'OLD' });
    check(prefix + 'e', 'OLD token rejected by our backend AND GoTrue',
        stale.a.status !== 200 && stale.b.status !== 200,
        `backend=${stale.a.status} gotrue=${stale.b.status}` +
        (stale.b.status === 200 ? '  ← GoTrue still accepts it; revocation broke' : ''));

    return newToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAILPIT / OTP
//   (verbatim from verify-block-f.mjs)
// ─────────────────────────────────────────────────────────────────────────────

async function purgeMailbox() {
    const res = await fetch(MAILPIT + '/api/v1/messages', { method: 'DELETE' });
    if (!res.ok) abort('Mailpit refused to clear the mailbox (' + res.status + ')');
}

/** Newest OTP addressed to `email`, or null. */
async function readOtp(email, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    const target = email.toLowerCase();

    while (Date.now() < deadline) {
        const listRes = await fetch(MAILPIT + '/api/v1/messages?limit=50');
        if (listRes.ok) {
            const list = await listRes.json();
            // Mailpit returns newest first.
            const mine = (list.messages || []).find((m) =>
                (m.To || []).some((t) => (t.Address || '').toLowerCase() === target));

            if (mine) {
                const msgRes = await fetch(MAILPIT + `/api/v1/message/${mine.ID}`);
                if (msgRes.ok) {
                    const msg = await msgRes.json();
                    const hay = `${msg.Text || ''}\n${msg.HTML || ''}`;
                    const m = hay.match(/\b\d{6,8}\b/);
                    if (m) return m[0];
                }
            }
        }
        await sleep(500);
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRECONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

async function preconditions() {
    head('PRECONDITIONS');

    const health = await api('GET', '/api/health');
    if (health.status !== 200) {
        const root = await api('GET', '/');
        if (root.status !== 200) {
            abort('Backend is not responding at ' + API,
                `GET /api/health → ${health.status || 'no connection'}` +
                `${health.networkError ? ' (' + health.networkError + ')' : ''}\n` +
                'Start it with `npm run dev` in backend/.');
        }
        step(green('✓') + ' backend up (GET / → 200)');
    } else {
        step(green('✓') + ' backend up (GET /api/health → 200)');
    }

    detectPsql();
    let ping;
    try {
        ping = sqlOne('select 1');
    } catch (e) {
        abort('psql cannot connect to the local database.', e.message);
    }
    if (ping !== '1') abort('psql connected but `select 1` did not return 1.', String(ping));
    step(green('✓') + ' database reachable (' + psqlMode +
        (psqlMode === 'docker' ? ' — psql not on PATH, using the supabase db container' : '') + ')');

    let mp;
    try {
        mp = await fetch(MAILPIT + '/api/v1/messages?limit=1');
    } catch (e) {
        abort('Mailpit is not responding at ' + MAILPIT, String(e));
    }
    if (!mp.ok) abort('Mailpit returned ' + mp.status + ' for /api/v1/messages');
    step(green('✓') + ' mailpit up (GET /api/v1/messages → 200)');

    ANON_KEY = readAnonKey();
    const probe = await http('GET', GOTRUE + '/auth/v1/settings', { headers: { apikey: ANON_KEY } });
    if (probe.status !== 200) {
        abort('GoTrue did not accept the anon key from backend/.env',
            `GET ${GOTRUE}/auth/v1/settings → ${probe.status}\n` +
            'Call B would then 401 for the wrong reason and the diagnosis would be worthless.');
    }
    step(green('✓') + ' gotrue up and anon key valid (GET /auth/v1/settings → 200)');
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

function cleanupFixtures() {
    // public.users.id → auth.users.id is ON DELETE CASCADE (users_id_fkey), so
    // one delete removes both rows and everything hanging off them.
    const users = sql(`delete from auth.users where email like ${q(EMAIL_PREFIX + '%')} returning id`);
    sql(`delete from public.auth_attempts where identifier like ${q('blockgdiag%')}`);
    return { users: users.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION SNAPSHOT — the direct evidence for or against revocation
// ─────────────────────────────────────────────────────────────────────────────

function snapshotSessions(uuid) {
    const sessions = sql(
        `select id, user_id, created_at, not_after, refreshed_at
           from auth.sessions where user_id = ${q(uuid)} order by created_at`,
    ).map((r) => ({
        id: r[0], user_id: r[1], created_at: r[2], not_after: r[3], refreshed_at: r[4],
    }));

    const refreshTokens = Number(
        sqlOne(`select count(*) from auth.refresh_tokens where user_id = ${q(uuid)}`) ?? '0',
    );

    // Belt and braces: GoTrue keys refresh_tokens.user_id by the user's *id*
    // in some versions and by session in others. Count by session too so a
    // schema difference cannot silently read as "zero tokens".
    const bySession = sessions.length
        ? Number(sqlOne(
            `select count(*) from auth.refresh_tokens
              where session_id in (${sessions.map((s) => q(s.id)).join(',')})`) ?? '0')
        : 0;

    return { sessions, refreshTokens, bySession };
}

function printSnapshot(label, snap) {
    step(bold(label));
    if (!snap.sessions.length) {
        step(dim('    auth.sessions: ') + red('NO ROWS'));
    } else {
        for (const s of snap.sessions) {
            step(dim('    session ') + cyan(s.id) +
                dim(`  created=${s.created_at}  not_after=${s.not_after || 'null'}  refreshed=${s.refreshed_at || 'null'}`));
        }
    }
    step(dim('    auth.refresh_tokens by user_id: ') + snap.refreshTokens +
        dim('   by session_id: ') + snap.bySession);
}

function diffSnapshots(before, after) {
    const beforeIds = new Set(before.sessions.map((s) => s.id));
    const afterIds  = new Set(after.sessions.map((s) => s.id));

    const disappeared = [...beforeIds].filter((id) => !afterIds.has(id));
    const appeared    = [...afterIds].filter((id) => !beforeIds.has(id));

    const changed = [];
    for (const b of before.sessions) {
        const a = after.sessions.find((s) => s.id === b.id);
        if (!a) continue;
        if (a.not_after !== b.not_after) {
            changed.push(`${b.id}: not_after ${b.not_after || 'null'} → ${a.not_after || 'null'}`);
        }
    }

    return {
        disappeared,
        appeared,
        changed,
        refreshDelta:  after.refreshTokens - before.refreshTokens,
        refreshBefore: before.refreshTokens,
        refreshAfter:  after.refreshTokens,
        sessionCountBefore: before.sessions.length,
        sessionCountAfter:  after.sessions.length,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Fresh OTP-verified user. Returns { token, uuid }. No onboarding. */
async function signUpFresh(spec) {
    step(`creating ${spec.label} — ${spec.email}`);
    await purgeMailbox();

    const otpReq = await api('POST', '/api/auth/request-otp', { body: { email: spec.email } });
    if (otpReq.status !== 200) {
        abort(`request-otp failed for ${spec.email}`, `${otpReq.status} ${otpReq.text}`);
    }

    const otp = await readOtp(spec.email);
    if (!otp) abort(`No OTP arrived in Mailpit for ${spec.email} within 10s.`);
    step(dim(`  otp ${otp}`));

    const verify = await api('POST', '/api/auth/verify-otp', { body: { email: spec.email, otp } });
    if (verify.status !== 200) {
        abort(`verify-otp failed for ${spec.email}`, `${verify.status} ${verify.text}`);
    }

    const token = verify.body?.session?.access_token;
    const uuid  = verify.body?.userAuth?.id ?? verify.body?.userProfile?.id;
    if (!token) abort(`verify-otp returned no session.access_token for ${spec.email}`, verify.text);
    if (!isUuid(uuid)) abort(`verify-otp returned no usable user id for ${spec.email}`, verify.text);

    step(green('✓') + ` ${spec.label} created  uuid=${cyan(uuid)}`);
    return { token, uuid };
}

/** Real course + specialization ids, so the onboarding body in S5 is valid.
 *  Looked up by name, never hardcoded — docs/CHANGELOG.md 2026-08-12 records
 *  that the fixed c0…/d0… seed ids do not exist after a reset. */
function pickAcademics() {
    const courseId = sqlOne('select id from public.courses order by name limit 1');
    const specId   = sqlOne('select id from public.specializations order by name limit 1');
    if (!isUuid(courseId) || !isUuid(specId)) {
        abort('No courses/specializations in the local database.',
            'Run `supabase db reset` to load seed.sql, then re-run.');
    }
    return { courseId, specId };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC INSPECTION — candidate 3, read from the source rather than guessed
// ─────────────────────────────────────────────────────────────────────────────

function readSrc(rel) {
    const p = path.join(REPO_ROOT, rel);
    try {
        return readFileSync(p, 'utf8').split('\n');
    } catch (e) {
        abort('Cannot read ' + rel, String(e));
    }
}

/** Every file under backend/src, so the grep is real and not a guess. */
function walkSrc(dir, acc = []) {
    const out = execFileSync('find', [path.join(REPO_ROOT, dir), '-type', 'f', '-name', '*.js'],
        { encoding: 'utf8' });
    for (const f of out.split('\n')) if (f.trim()) acc.push(f.trim());
    return acc;
}

function staticInspection() {
    head('S8  STATIC INSPECTION — where does each signInWithPassword live?');

    const files = walkSrc('backend/src');
    const hits = [];

    for (const abs of files) {
        const rel = path.relative(REPO_ROOT, abs);
        const lines = readFileSync(abs, 'utf8').split('\n');
        lines.forEach((line, i) => {
            if (line.includes('signInWithPassword')) hits.push({ rel, n: i + 1, lines });
        });
    }

    if (!hits.length) {
        step(yellow('No signInWithPassword call found under backend/src — unexpected.'));
    }

    const findings = [];

    for (const h of hits) {
        // Look back a few lines: the call may be split across lines, e.g.
        //   const { data } =
        //       await createSessionClient().auth.signInWithPassword({
        const from = Math.max(0, h.n - 6);
        const to   = Math.min(h.lines.length, h.n + 3);
        const window = h.lines.slice(from, to).join('\n');

        const onThrowaway = /createSessionClient\(\)\s*\.\s*auth\s*\.\s*signInWithPassword/.test(window);
        const onShared    = /(?<!createSessionClient\(\)\.)\bsupabase\s*\.\s*auth\s*\.\s*signInWithPassword/.test(window);

        // A comment mentioning the call is not a call.
        const isComment = /^\s*(\/\/|\*)/.test(h.lines[h.n - 1]);

        log('');
        step(bold(`${h.rel}:${h.n}`) + (isComment ? dim('   (comment, not a call site)') : ''));
        for (let i = from; i < to; i++) {
            const marker = i === h.n - 1 ? red(' >') : dim('  ');
            log(dim(`      ${String(i + 1).padStart(4)}`) + marker + ' ' + h.lines[i]);
        }

        if (isComment) {
            step(dim('    → documentation, no client involved'));
            continue;
        }

        const verdict = onThrowaway
            ? green('PER-REQUEST client from createSessionClient() — correct')
            : onShared
                ? red(bold('SHARED module-level `supabase` client — THIS DEMOTES THE PROCESS'))
                : yellow('could not classify — read it by hand');

        step('    → ' + verdict);
        findings.push({ where: `${h.rel}:${h.n}`, onThrowaway, onShared });
    }

    // How does requireAuth get its client?
    head('S8  requireAuth — which client does it use?');
    const mw = readSrc('backend/src/middleware/requireAuth.js');
    mw.forEach((line, i) => {
        if (/import|getUser|supabase/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
            log(dim(`      ${String(i + 1).padStart(4)}  `) + line);
        }
    });
    const sharedImport = mw.some((l) =>
        /^\s*import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*['"]\.\.\/config\/supabase\.js['"]/.test(l));
    const usesGetUser  = mw.some((l) => /supabase\.auth\.getUser\(/.test(l));
    step('    → imports the module-level shared client: ' +
        (sharedImport ? red(bold('YES')) : green('no')));
    step('    → validates via supabase.auth.getUser(token): ' +
        (usesGetUser ? bold('YES') : 'no'));
    step(dim('      getUser(jwt) sends the jwt as Authorization and the client key as apikey,'));
    step(dim('      so it is a network call to GoTrue. If B succeeds and A does not, the'));
    step(dim('      difference is NOT this call — look at what runs after it.'));

    // createSessionClient definition.
    head('S8  createSessionClient() — definition');
    const cfg = readSrc('backend/src/config/supabase.js');
    const defAt = cfg.findIndex((l) => /export const createSessionClient/.test(l));
    if (defAt === -1) {
        step(red('createSessionClient is not exported from config/supabase.js'));
    } else {
        for (let i = defAt; i < Math.min(cfg.length, defAt + 10); i++) {
            log(dim(`      ${String(i + 1).padStart(4)}  `) + cfg[i]);
        }
    }

    return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SEQUENCE
// ─────────────────────────────────────────────────────────────────────────────

const RESULT = {
    s2: null, s3: null, s6: null,
    s5Status: null, s5HasSession: null,
    s7: null,
    s9: null,
    staticFindings: null,
    u1: null, u2: null, u3: null,
};

async function run() {
    head('S1  fresh user + OTP token T1');
    const { courseId, specId } = pickAcademics();
    step(dim(`course_id=${courseId}  specialization_id=${specId}`));

    const u1 = await signUpFresh(USER_1);
    RESULT.u1 = u1;
    const T1 = u1.token;

    head('S2  first pair with T1');
    RESULT.s2 = await pair('S2', T1, { label: 'T1' });
    step('    → ' + VERDICT_TEXT[RESULT.s2.verdict]);

    head('S3  SAME token again, immediately, nothing in between');
    step(dim('  Direct test of the "token dies after one use" theory. No request is'));
    step(dim('  made between S2 and S3 — not by this script, and nothing else is'));
    step(dim('  driving the backend.'));
    RESULT.s3 = await pair('S3', T1, { label: 'T1' });
    step('    → ' + VERDICT_TEXT[RESULT.s3.verdict]);

    if (RESULT.s2.a.status === 200 && RESULT.s3.a.status === 401) {
        log('');
        log(red(bold('  ⚠ FINDING: S2-A was 200 and S3-A is 401 with NOTHING in between.')));
        log(red(bold('    A single-use access token is not normal GoTrue behaviour. Report this.')));
    }

    head('S4  session snapshot BEFORE onboarding');
    const before = snapshotSessions(u1.uuid);
    printSnapshot('auth.sessions / auth.refresh_tokens for ' + u1.uuid, before);

    head('S5  POST /api/auth/onboarding with T1');
    printJwt('T1', T1);
    const onboard = await api('POST', '/api/auth/onboarding', {
        token: T1,
        body: {
            full_name:         'Block G Diag',
            username:          USER_1.username,
            password:          PASSWORD,
            qualification:     'Graduation',
            course_id:         courseId,
            year_of_study:     '3rd year',
            specialization_id: specId,
        },
    });
    record('S5', 'POST /api/auth/onboarding', onboard, T1);
    RESULT.s5Status = onboard.status;
    log(dim(`  ${stamp()} `) + bold('S5  ') + ' onboarding  ' +
        (onboard.status === 200 ? green(String(onboard.status)) : red(String(onboard.status))));
    log('');
    step(bold('FULL RESPONSE BODY:'));
    log(dim('      ') + (onboard.text || '(empty)').split('\n').join('\n      '));
    log('');

    // The question the report has to answer: does onboarding hand back a new
    // session to replace the one it is about to invalidate?
    const hasSession = !!(onboard.body && typeof onboard.body === 'object' && onboard.body.session);
    RESULT.s5HasSession = hasSession;
    step('    → response contains a `session`: ' +
        (hasSession ? green('YES') : red(bold('NO — the caller is left holding a dead token'))));
    step(dim('      top-level keys: ') +
        (onboard.body && typeof onboard.body === 'object'
            ? Object.keys(onboard.body).join(', ')
            : '(not an object)'));

    head('S6  pair with T1 again, after onboarding');
    RESULT.s6 = await pair('S6', T1, { label: 'T1' });
    step('    → ' + VERDICT_TEXT[RESULT.s6.verdict]);

    head('S7  session snapshot AFTER onboarding, diffed against S4');
    const after = snapshotSessions(u1.uuid);
    printSnapshot('AFTER', after);
    const d = diffSnapshots(before, after);
    log('');
    step(bold('DIFF S4 → S7'));
    step(dim('    sessions:        ') + `${d.sessionCountBefore} → ${d.sessionCountAfter}`);
    step(dim('    disappeared:     ') +
        (d.disappeared.length ? red(d.disappeared.join(', ')) : 'none'));
    step(dim('    appeared:        ') +
        (d.appeared.length ? yellow(d.appeared.join(', ')) : 'none'));
    step(dim('    not_after changed: ') +
        (d.changed.length ? yellow(d.changed.join('; ')) : 'none'));
    step(dim('    refresh_tokens:  ') +
        `${d.refreshBefore} → ${d.refreshAfter}` +
        (d.refreshAfter === 0 && d.refreshBefore > 0 ? red(bold('  ← dropped to ZERO')) : ''));
    RESULT.s7 = d;

    if (d.disappeared.length && d.sessionCountAfter === 0) {
        log('');
        log(red(bold('  ⚠ The session row is GONE. That is revocation, not expiry.')));
    }

    // ── S8 static ────────────────────────────────────────────────────────────
    RESULT.staticFindings = staticInspection();

    // ── S9 empirical demotion test ───────────────────────────────────────────
    head('S9  does a password login demote the shared client for OTHER users?');
    step(dim('  U2 is unrelated to U1. If U2\'s token works, then stops working the'));
    step(dim('  moment U1 logs in with a password, the shared client is being demoted'));
    step(dim('  process-wide and that is the root cause.'));

    const u2 = await signUpFresh(USER_2);
    RESULT.u2 = u2;
    const T2 = u2.token;

    head('S9a  T2 BEFORE the password login');
    const pidBefore = backendPid();
    step(dim('    backend pid: ') + (pidBefore ?? 'unknown'));
    const s9a = await pair('S9a', T2, { label: 'T2' });
    step('    → ' + VERDICT_TEXT[s9a.verdict]);

    head('S9b  POST /api/auth/login-password as U1 (the demoting call)');
    const login = await api('POST', '/api/auth/login-password', {
        body: { identifier: USER_1.username, password: PASSWORD },
    });
    record('S9b', 'POST /api/auth/login-password (U1)', login, T2);
    log(dim(`  ${stamp()} `) + bold('S9b ') + ' login-password  ' +
        (login.status === 200 ? green(String(login.status)) : red(String(login.status))) +
        dim('  ' + (errorCode(login) ?? '-')));
    if (login.status !== 200) {
        step(yellow('    login-password did not succeed; S9 cannot prove or disprove demotion.'));
        step(dim('    body: ' + (login.text || '').slice(0, 200)));
    }

    head('S9c  T2 AFTER the password login — same token string as S9a');
    const pidAfter = backendPid();
    step(dim('    backend pid: ') + (pidAfter ?? 'unknown') +
        (pidBefore && pidAfter && pidBefore !== pidAfter
            ? red(bold('   ← RESTARTED between S9a and S9c'))
            : dim('   (unchanged)')));
    const s9c = await pair('S9c', T2, { label: 'T2' });
    step('    → ' + VERDICT_TEXT[s9c.verdict]);

    const restarted = !!(pidBefore && pidAfter && pidBefore !== pidAfter);
    RESULT.s9 = { before: s9a, loginStatus: login.status, after: s9c, pidBefore, pidAfter, restarted };

    if (restarted) {
        log('');
        log(yellow(bold('  ⚠ The backend process restarted mid-test (nodemon). In-memory')));
        log(yellow(bold('    demotion cannot survive a restart, so S9 proves NOTHING here.')));
        log(yellow('    Re-run with the backend started via `npm start`, not `npm run dev`.'));
    } else if (s9a.a.status === 200 && s9c.a.status !== 200) {
        log('');
        log(red(bold('  🚨 CRITICAL: an unrelated user\'s token worked before U1\'s password')));
        log(red(bold('     login and fails after it. The shared client is being demoted.')));
    } else if (s9a.a.status === 200 && s9c.a.status === 200) {
        log('');
        log(green('  ✓ U2 unaffected by U1\'s password login — no process-wide demotion.'));
    }

    // ── S10 the fix ──────────────────────────────────────────────────────────
    await s10();
}

// ─────────────────────────────────────────────────────────────────────────────
// S10 — THE FIX: both password-setting endpoints hand back a live session
//
// S5/S6/S7 established the bug: the caller's own token is revoked by
// `admin.updateUserById(..., { password })` and nothing replaces it. S10 proves
// the fix on a THIRD user, untouched by the steps above, and proves it twice —
// once for onboarding, once for set-password.
//
// The GoTrue leg matters as much as ours. A new token that only our middleware
// accepts would mean we minted something GoTrue does not know about; a
// 200 from /auth/v1/user is what makes it a real session.
// ─────────────────────────────────────────────────────────────────────────────

async function s10() {
    head('S10  THE FIX — does the caller get a working session back?');

    const { courseId, specId } = pickAcademics();

    // ── S10-1  onboarding ────────────────────────────────────────────────────
    head('S10-1  fresh user U3 → verify-otp → T1 → onboarding');
    const u3 = await signUpFresh(USER_3);
    RESULT.u3 = u3;
    const T1 = u3.token;

    const before = snapshotSessions(u3.uuid);
    step(dim('    auth.sessions before onboarding: ') + before.sessions.length +
         dim('   refresh_tokens: ') + before.refreshTokens);

    const onboard = await api('POST', '/api/auth/onboarding', {
        token: T1,
        body: {
            full_name:         'Block G Fix',
            username:          USER_3.username,
            password:          PASSWORD,
            qualification:     'Graduation',
            course_id:         courseId,
            year_of_study:     '3rd year',
            specialization_id: specId,
        },
    });
    record('S10-1', 'POST /api/auth/onboarding', onboard, T1);
    log(dim(`  ${stamp()} `) + bold('S10-1') + ' onboarding  ' +
        (onboard.status === 200 ? green(String(onboard.status)) : red(String(onboard.status))));
    log('');

    const T2 = await assertSessionReplaced('S10-1', 'POST /api/auth/onboarding', onboard, T1);

    const afterOnboard = snapshotSessions(u3.uuid);
    log('');
    step(dim('    auth.sessions after onboarding:  ') + afterOnboard.sessions.length +
         dim('   refresh_tokens: ') + afterOnboard.refreshTokens);
    step(dim('    (the old session was destroyed and a replacement created — the'));
    step(dim('     count is not evidence on its own, the token tests above are.)'));

    if (!T2) {
        log('');
        log(red(bold('  S10-2 cannot run: onboarding returned no session to authenticate with.')));
        check('S10-2', 'set-password leg', false, 'skipped — no token from S10-1');
        return;
    }

    // ── S10-2  set-password, authenticated with the token S10-1 minted ───────
    //
    // Using T2 here is itself part of the proof: if the replacement session
    // were not real, this call would 401 before it ever reached the handler.
    head('S10-2  POST /api/auth/set-password with the NEW token from S10-1');
    step(dim('    changing ' + PASSWORD + ' → ' + PASSWORD_2 + ' (must differ, or GoTrue'));
    step(dim('     may treat it as a no-op and revoke nothing)'));

    const setpw = await api('POST', '/api/auth/set-password', {
        token: T2,
        body: { password: PASSWORD_2, current_password: PASSWORD },
    });
    record('S10-2', 'POST /api/auth/set-password', setpw, T2);
    log(dim(`  ${stamp()} `) + bold('S10-2') + ' set-password  ' +
        (setpw.status === 200 ? green(String(setpw.status)) : red(String(setpw.status))) +
        dim('  ' + (errorCode(setpw) ?? '-')));
    log('');
    step(bold('FULL RESPONSE BODY:'));
    log(dim('      ') + (setpw.text || '(empty)').split('\n').join('\n      '));
    log('');

    const T3 = await assertSessionReplaced('S10-2', 'POST /api/auth/set-password', setpw, T2);

    // ── S10-3  the existing keys are still there ─────────────────────────────
    //
    // The fix is additive. If it quietly replaced a body instead of extending
    // one, Neeraj's clients break and every token assertion above still passes.
    head('S10-3  the change is ADDITIVE — existing keys survive');
    const ob = onboard.body || {};
    check('S10-3a', 'onboarding still returns `message`',
        typeof ob.message === 'string', 'got: ' + JSON.stringify(ob.message));
    check('S10-3b', 'onboarding still returns `userProfile`',
        !!ob.userProfile && typeof ob.userProfile === 'object',
        'keys: ' + (ob.userProfile ? Object.keys(ob.userProfile).length + ' fields' : 'absent'));

    const sb = setpw.body || {};
    check('S10-3c', 'set-password still returns `message` + `has_password`',
        typeof sb.message === 'string' && sb.has_password === true,
        `message=${JSON.stringify(sb.message)} has_password=${JSON.stringify(sb.has_password)}`);

    // ── S10-4  the new password is the one that actually works ───────────────
    head('S10-4  the account is usable with the new password');
    const relogin = await api('POST', '/api/auth/login-password', {
        body: { identifier: USER_3.username, password: PASSWORD_2 },
    });
    record('S10-4', 'POST /api/auth/login-password (U3, new pw)', relogin, T3);
    check('S10-4a', 'login-password succeeds with the NEW password',
        relogin.status === 200 && !!relogin.body?.session?.access_token,
        `status=${relogin.status} ${(relogin.text || '').slice(0, 100)}`);

    const stale = await api('POST', '/api/auth/login-password', {
        body: { identifier: USER_3.username, password: PASSWORD },
    });
    record('S10-4', 'POST /api/auth/login-password (U3, old pw)', stale, null);
    check('S10-4b', 'login-password REJECTS the old password',
        stale.status !== 200,
        `status=${stale.status} ${errorCode(stale) ?? '-'}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────

function report() {
    head('TIMESTAMPED CALL TABLE');

    const w = { step: 10, call: 42, status: 7, code: 24, ttl: 10 };
    log(
        '  ' + bold('time'.padEnd(13)) + bold('step'.padEnd(w.step)) +
        bold('call'.padEnd(w.call)) + bold('status'.padEnd(w.status)) +
        bold('error code'.padEnd(w.code)) + bold('exp-now'),
    );
    log(dim('  ' + '─'.repeat(13 + w.step + w.call + w.status + w.code + w.ttl)));

    for (const r of ROWS) {
        const statusText = String(r.status).padEnd(w.status);
        const colored = r.status === 200 ? green(statusText)
            : r.status === 0 ? red(statusText) : red(statusText);
        log(
            '  ' + dim(r.time.padEnd(13)) + r.step.padEnd(w.step) +
            r.call.padEnd(w.call) + colored +
            (r.code ?? '-').padEnd(w.code) +
            (r.ttl === null ? '?' : `${r.ttl}s`),
        );
    }

    // ── The conclusion ──────────────────────────────────────────────────────
    head('CONCLUSION');

    const s2 = RESULT.s2, s3 = RESULT.s3, s6 = RESULT.s6, s9 = RESULT.s9;

    const anyExpired = ROWS.some((r) => r.ttl !== null && r.ttl <= 0 && r.status !== 200);
    const s9Reproduced = s9 && !s9.restarted &&
        s9.before.a.status === 200 && s9.after.a.status !== 200;
    const sharedClientHit = (RESULT.staticFindings || []).some((f) => f.onShared);

    // Where did it break, and what does B say about it?
    const brokeAtOnboarding = s3?.a.status === 200 && s6?.a.status !== 200;
    const brokeSingleUse    = s2?.a.status === 200 && s3?.a.status !== 200;
    const gotrueAgrees      = s6?.b.status !== 200;

    let verdict, detail;

    if (anyExpired) {
        verdict = '(a) EXPIRY';
        detail  = 'A failing call had exp already in the past.';
    } else if (s9Reproduced || sharedClientHit) {
        verdict = '(c) SHARED CLIENT';
        detail  = 'An unrelated user\'s valid token started failing after a password login.';
    } else if (brokeSingleUse) {
        verdict = '(d) SOMETHING ELSE — single-use token';
        detail  = 'S2-A succeeded and S3-A failed with no request in between.';
    } else if (brokeAtOnboarding && gotrueAgrees) {
        verdict = '(b) REVOCATION';
        detail  = 'The token survived repeated calls, died exactly at onboarding, and GoTrue ' +
                  'itself rejects it afterwards. ' +
                  (RESULT.s7?.sessionCountAfter === 0
                      ? 'The auth.sessions row is gone.'
                      : 'See the S4→S7 diff above.');
    } else if (brokeAtOnboarding && !gotrueAgrees) {
        verdict = '(c) SHARED CLIENT';
        detail  = 'The token died at onboarding for OUR backend but GoTrue still accepts it.';
    } else {
        verdict = '(d) SOMETHING ELSE';
        detail  = 'No step reproduced a 401 on a token that had worked. See the table.';
    }

    log('  ' + bold(verdict));
    log('  ' + detail);
    log('');
    log(dim('  Evidence summary'));
    log(dim('    S2-A ') + (s2 ? s2.a.status : '-') + dim('   S2-B ') + (s2 ? s2.b.status : '-'));
    log(dim('    S3-A ') + (s3 ? s3.a.status : '-') + dim('   S3-B ') + (s3 ? s3.b.status : '-'));
    log(dim('    S6-A ') + (s6 ? s6.a.status : '-') + dim('   S6-B ') + (s6 ? s6.b.status : '-'));
    if (s9) {
        log(dim('    S9a-A ') + s9.before.a.status + dim('  S9a-B ') + s9.before.b.status +
            dim('   login ') + s9.loginStatus +
            dim('   S9c-A ') + s9.after.a.status + dim('  S9c-B ') + s9.after.b.status);
    }
    log(dim('    onboarding returned a session: ') +
        (RESULT.s5HasSession ? 'yes' : 'NO'));
    if (RESULT.s7) {
        log(dim('    sessions ') + RESULT.s7.sessionCountBefore + ' → ' + RESULT.s7.sessionCountAfter +
            dim('    refresh_tokens ') + RESULT.s7.refreshBefore + ' → ' + RESULT.s7.refreshAfter);
    }

    // ── S10 — the regression gate ───────────────────────────────────────────
    //
    // Everything above this line is observation. This block is pass/fail and it
    // owns the exit code: S1–S9 reporting a bad reading is a finding, S10
    // reporting one is a broken fix.
    head('S10  FIX VERIFICATION');

    if (!S10.length) {
        log('  ' + yellow(bold('S10 did not run.')) +
            ' The diagnosis stopped before reaching it.');
        log('');
        return 1;
    }

    const wS = { id: 9, desc: 62 };
    log('  ' + bold('check'.padEnd(wS.id)) + bold('assertion'.padEnd(wS.desc)) + bold('result'));
    log(dim('  ' + '─'.repeat(wS.id + wS.desc + 8)));
    for (const cRow of S10) {
        log(
            '  ' + cRow.id.padEnd(wS.id) + cRow.desc.padEnd(wS.desc) +
            (cRow.ok ? green('PASS') : red(bold('FAIL'))),
        );
        if (!cRow.ok && cRow.detail) log(dim('      ' + cRow.detail));
    }

    const failed = S10.filter((cRow) => !cRow.ok);
    log('');
    if (failed.length === 0) {
        log('  ' + green(bold(`✓ S10 PASSED — ${S10.length}/${S10.length} assertions.`)));
        log('  ' + dim('Both password-setting endpoints hand the caller a session that'));
        log('  ' + dim('GoTrue itself accepts, and the old token is dead at both hops —'));
        log('  ' + dim('so other devices still get logged out, which is the point.'));
    } else {
        log('  ' + red(bold(`✗ S10 FAILED — ${failed.length}/${S10.length} assertion(s).`)));
        for (const f of failed) log('  ' + red('    ' + f.id + '  ' + f.desc));
    }

    log('');
    log(dim('  Fixtures left in place: ' + USER_1.email + ', ' + USER_2.email +
            ', ' + USER_3.email));
    log(dim('  Remove with: node backend/scripts/diagnose-token.mjs --cleanup'));
    log('');
    return failed.length === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    log(bold('\nTOKEN DIAGNOSIS') + dim('  —  why does password-status 401 on a working token?'));

    assertLocalDatabase();

    if (process.argv.includes('--cleanup')) {
        detectPsql();
        head('CLEANUP');
        const removed = cleanupFixtures();
        step(green('✓') + ` removed ${removed.users} blockg.diag account(s)`);
        log('');
        process.exit(0);
    }

    await preconditions();

    head('RESET FIXTURES');
    const removed = cleanupFixtures();
    step(green('✓') + ` removed ${removed.users} account(s) from a previous run`);

    await run();
    process.exit(report());
}

main().catch((e) => {
    log('\n' + red(bold('UNHANDLED ERROR')));
    log(e?.stack || String(e));
    log(red('The diagnosis did not finish. Nothing below the failure point was established.'));
    process.exit(1);
});
