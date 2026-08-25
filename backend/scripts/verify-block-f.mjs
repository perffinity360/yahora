#!/usr/bin/env node
// backend/scripts/verify-block-f.mjs
// ══════════════════════════════════════════════
// OWNER: VISHWAJEET   —   Block F verification harness
// ══════════════════════════════════════════════
//
// Re-runnable verification of docs/PHASE_1_RUNBOOK.md BLOCK F — the five
// security checks for CC-6, plus the two messages checks Block F's table
// omits (CC-6 closes four holes, the checklist only covers three).
//
// This script VERIFIES. It never edits application code. A failing test is
// the deliverable, not a bug to be worked around here.
//
//   node backend/scripts/verify-block-f.mjs             run the suite
//   node backend/scripts/verify-block-f.mjs --cleanup   drop fixtures, exit
//
// Fixtures are rebuilt from scratch on every run and deliberately LEFT IN
// PLACE afterwards so a failure can be inspected in Studio.
//
// ⚠️ LOCAL STACK ONLY. Aborts unless DB_URL resolves to 127.0.0.1:54322.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

const API     = 'http://localhost:5000';
const DB_URL  = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const MAILPIT = 'http://127.0.0.1:54324';

// The local `supabase start` database container. Only ever used as a fallback
// when psql is not on PATH, and only after DB_URL has been asserted local.
const DB_CONTAINER = 'supabase_db_yahora';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const USER_A = { email: 'blockf.a@iiitk.ac.in', username: 'blockfa2026', label: 'A (IIITK)' };
const USER_B = { email: 'blockf.b@niet.co.in',  username: 'blockfb2026', label: 'B (NIET)'  };
const PASSWORD = 'blockfpass123';

const PRODUCT_PREFIX = 'BLOCKF_';
const EMAIL_PREFIX   = 'blockf';

// ─────────────────────────────────────────────────────────────────────────────
// Output helpers
// ─────────────────────────────────────────────────────────────────────────────

const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold   = (s) => c('1', s);
const red    = (s) => c('31', s);
const green  = (s) => c('32', s);
const yellow = (s) => c('33', s);
const dim    = (s) => c('2', s);

const log  = (...a) => console.log(...a);
const step = (s) => log(dim('  · ') + s);
const head = (s) => log('\n' + bold('── ' + s + ' ' + '─'.repeat(Math.max(0, 68 - s.length))));

/** Abort loudly. Nothing below this line is safe to keep running. */
function abort(reason, detail) {
    log('\n' + red(bold('ABORT: ' + reason)));
    if (detail) log(dim(String(detail)));
    log(red('Nothing was verified. Fix the above and re-run.'));
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety: this harness deletes and inserts rows. It must never be pointed
// anywhere but the local stack.
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
    if (/supabase\.co/i.test(DB_URL) || /supabase\.co/i.test(API)) {
        abort('A *.supabase.co host appears in the configuration — refusing to run.');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL — shell out to psql (no new dependency; `pg` is not a backend dep)
// ─────────────────────────────────────────────────────────────────────────────

const FS = '\u001f'; // ASCII unit separator: cannot appear in our data

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

/** Single-quote a SQL literal. Our inputs are constants and validated uuids,
 *  but escaping is cheap and keeps the fixture SQL honest. */
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// ─────────────────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────────────────

async function api(method, pathname, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
        res = await fetch(API + pathname, {
            method,
            headers,
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

const errorCode = (r) => (r.body && typeof r.body === 'object' ? r.body.error ?? null : null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// PRECONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Discovered in preconditions, reported in the summary. Block F's table says
 *  PATCH; the route file is the authority. */
let UPDATE_VERB = null;

async function preconditions() {
    head('PRECONDITIONS');

    // 1. Backend up.
    const health = await api('GET', '/api/health');
    if (health.status !== 200) {
        const root = await api('GET', '/');
        if (root.status !== 200) {
            abort('Backend is not responding at ' + API,
                `GET /api/health → ${health.status || 'no connection'}` +
                `${health.networkError ? ' (' + health.networkError + ')' : ''}\n` +
                'Start it with `npm run dev` in backend/.');
        }
        step(green('✓') + ' backend up (GET / → 200; /api/health → ' + health.status + ')');
    } else {
        step(green('✓') + ' backend up (GET /api/health → 200)');
    }

    // 2. psql connects.
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

    // 3. Mailpit.
    let mp;
    try {
        mp = await fetch(MAILPIT + '/api/v1/messages?limit=1');
    } catch (e) {
        abort('Mailpit is not responding at ' + MAILPIT, String(e));
    }
    if (!mp.ok) abort('Mailpit returned ' + mp.status + ' for /api/v1/messages');
    step(green('✓') + ' mailpit up (GET /api/v1/messages → 200)');

    // 4. Which verb does the update route actually declare?
    //    The runbook's Block F table says PATCH. That is a known error in the
    //    runbook — the route file wins, and the summary reports what we used.
    const routesPath = path.join(REPO_ROOT, 'backend/src/modules/products/products.routes.js');
    let routesSrc;
    try {
        routesSrc = readFileSync(routesPath, 'utf8');
    } catch (e) {
        abort('Cannot read ' + routesPath, String(e));
    }
    const hits = routesSrc
        .split('\n')
        .map((line, i) => ({ n: i + 1, line: line.trim() }))
        .filter(({ line }) => /router\.(put|patch)\(\s*['"]\/:id['"]/.test(line));

    if (hits.length === 0) {
        abort("No router.put / router.patch on '/:id' found in products.routes.js",
            'Block F cannot be verified without the update route.');
    }
    for (const h of hits) step(dim(`products.routes.js:${h.n}: `) + h.line);

    UPDATE_VERB = /router\.put\(/.test(hits[0].line) ? 'PUT' : 'PATCH';
    step(green('✓') + ` update verb resolved to ${bold(UPDATE_VERB)} ` +
        dim('(the runbook Block F table says PATCH — route file is authoritative)'));
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

function cleanupFixtures() {
    // Products first, by title prefix: BLOCKF_OTHER is owned by a *seeded*
    // student who must survive, so it cannot be cleaned up via its seller.
    const products = sql(
        `delete from public.products where title like ${q(PRODUCT_PREFIX + '%')} returning id`,
    );

    // Any conversation a blockf account is party to. They are freshly minted on
    // every run and never send messages, so this is belt-and-braces for a
    // hand-poked database.
    const blockfIds = sql(
        `select id from auth.users where email like ${q(EMAIL_PREFIX + '%')}`,
    ).map((r) => r[0]);

    if (blockfIds.length) {
        const list = blockfIds.map(q).join(',');
        sql(`delete from public.messages where sender_id in (${list}) or receiver_id in (${list})`);
    }

    // public.users.id → auth.users.id is ON DELETE CASCADE (users_id_fkey), and
    // product_likes / product_saves / comments cascade from public.users, so one
    // delete is enough.
    const users = sql(`delete from auth.users where email like ${q(EMAIL_PREFIX + '%')} returning id`);

    return { products: products.length, users: users.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAILPIT / OTP
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
// PHASE 1 — FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

async function createUser(spec, courseId, specializationId) {
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

    const otpToken = verify.body?.session?.access_token;
    const uuid  = verify.body?.userAuth?.id ?? verify.body?.userProfile?.id;
    if (!otpToken) abort(`verify-otp returned no session.access_token for ${spec.email}`, verify.text);
    if (!isUuid(uuid)) abort(`verify-otp returned no usable user id for ${spec.email}`, verify.text);

    const onboard = await api('POST', '/api/auth/onboarding', {
        token: otpToken,
        body: {
            full_name:         spec === USER_A ? 'Block F A' : 'Block F B',
            username:          spec.username,
            password:          PASSWORD,
            qualification:     'Graduation',
            course_id:         courseId,
            year_of_study:     '3rd year',
            specialization_id: specializationId,
        },
    });
    if (onboard.status !== 200) {
        abort(`onboarding failed for ${spec.email}`, `${onboard.status} ${onboard.text}`);
    }

    // ⚠️ The OTP token is DEAD at this point, and this is not a harness quirk.
    // completeOnboarding sets the account password through
    // supabase.auth.admin.updateUserById, and GoTrue revokes the caller's other
    // sessions when a password changes — including the very session that made
    // the call. Verified: password-status returns 200 before onboarding and 401
    // immediately after, with the same token.
    //
    // So we log in again for a live token. Reusing the OTP one would make every
    // test below fail with 401 and prove nothing about Block F.
    const login = await api('POST', '/api/auth/login-password', {
        body: { identifier: spec.username, password: PASSWORD },
    });
    if (login.status !== 200) {
        abort(`login-password failed for ${spec.username} after onboarding`,
            `${login.status} ${login.text}`);
    }
    const liveToken = login.body?.session?.access_token;
    if (!liveToken) {
        abort(`login-password returned no session.access_token for ${spec.username}`, login.text);
    }

    // Cheap assertion that the token really is accepted, so a 401 later in the
    // suite is a finding about the endpoint rather than a stale fixture.
    const probe = await api('GET', '/api/auth/password-status', { token: liveToken });
    if (probe.status !== 200) {
        abort(`the fresh token for ${spec.username} is not accepted by requireAuth`,
            `GET /api/auth/password-status → ${probe.status} ${probe.text}`);
    }

    step(green('  ✓') + ` ${spec.label} = ${uuid} ` + dim('(re-authenticated after onboarding)'));
    return { token: liveToken, uuid };
}

async function buildFixtures() {
    head('PHASE 1 — FIXTURES');

    const removed = cleanupFixtures();
    step(`cleaned prior run: ${removed.products} product(s), ${removed.users} account(s)`);

    // Real reference ids. These are seeded with gen_random_uuid(), so they
    // change on every `supabase db reset` — always read them, never hardcode.
    const courseId = sqlOne('select id from public.courses order by name limit 1');
    const specId   = sqlOne('select id from public.specializations order by name limit 1');
    if (!isUuid(courseId) || !isUuid(specId)) {
        abort('No seeded course/specialization found.',
            'Run the seed (supabase db reset) before verifying Block F.');
    }
    step(dim(`course ${courseId} · specialization ${specId}`));

    const a = await createUser(USER_A, courseId, specId);
    const b = await createUser(USER_B, courseId, specId);

    // ── Campuses must differ, or tests 3 and 4 prove nothing ────────────────
    const campusRows = sql(
        `select id, username, coalesce(university_id::text, '') from public.users
          where id in (${q(a.uuid)}, ${q(b.uuid)})`,
    );
    const campusOf = Object.fromEntries(campusRows.map((r) => [r[0], r[2]]));
    const campusA = campusOf[a.uuid] || '';
    const campusB = campusOf[b.uuid] || '';

    if (!campusA || !campusB) {
        abort(
            'A blockf account has a NULL university_id.',
            'handle_new_user (migration 005) failed to resolve the email domain to a\n' +
            'campus. Tests 3 and 4 would be meaningless, so this run stops here.\n' +
            `  A ${a.uuid} → ${campusA || 'NULL'}\n  B ${b.uuid} → ${campusB || 'NULL'}`,
        );
    }
    if (campusA === campusB) {
        abort(
            'Both blockf accounts landed on the SAME campus.',
            `Cross-campus test 3 cannot be run.\n  A → ${campusA}\n  B → ${campusB}`,
        );
    }
    step(green('✓') + ` campuses differ — A ${campusA} · B ${campusB}`);

    // ── Products, by direct INSERT. This is setup, not a test. ──────────────
    //
    // OTHER lives on A's OWN campus on purpose: on B's campus a 403 in test 1
    // could come from the campus rule instead of the ownership rule, and the
    // test would prove nothing.
    const otherSeller =
        sqlOne(`select id from public.users
                 where university_id = ${q(campusA)}
                   and id not in (${q(a.uuid)}, ${q(b.uuid)})
                 order by created_at limit 1`)
        ?? sqlOne(`select id from public.users
                    where id not in (${q(a.uuid)}, ${q(b.uuid)})
                    order by created_at limit 1`);

    if (!isUuid(otherSeller)) {
        abort('No third student exists to own BLOCKF_OTHER.', 'Seed the database first.');
    }

    // image_urls is NOT NULL.
    const insert = (title, sellerId, campus) => sqlOne(
        `insert into public.products
           (title, description, price, category, condition, location, status, image_urls, seller_id, university_id)
         values (${q(title)}, 'Block F fixture — safe to delete', 100.00, 'Books', 'Good',
                 'Campus', 'available', ARRAY['https://example.com/x.jpg'],
                 ${q(sellerId)}, ${q(campus)})
         returning id`,
    );

    const OTHER = insert('BLOCKF_OTHER', otherSeller, campusA);
    const NIET  = insert('BLOCKF_NIET',  b.uuid,      campusB);
    const OWN   = insert('BLOCKF_OWN',   a.uuid,      campusA);

    step(`BLOCKF_OTHER ${OTHER} ` + dim(`seller ${otherSeller} · campus A`));
    step(`BLOCKF_NIET  ${NIET} `  + dim('seller B · campus B'));
    step(`BLOCKF_OWN   ${OWN} `   + dim('seller A · campus A'));

    // Test 4 must CREATE a like row, not toggle an existing one off.
    sql(`delete from public.product_likes
          where user_id = ${q(a.uuid)} and product_id = ${q(OTHER)}`);

    // Before-state, held in memory for the failure report.
    const before = sql(
        `select id, title, price::text, coalesce(status,'') from public.products
          where id in (${q(OTHER)}, ${q(OWN)}) order by title`,
    );
    step(dim('before-state: ' + before.map((r) => `${r[1]}=${r[2]}/${r[3]}`).join('  ')));

    return { a, b, campusA, campusB, OTHER, NIET, OWN, otherSeller, before };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT RECORDING
// ─────────────────────────────────────────────────────────────────────────────

const results = [];

function record(r) {
    results.push({ notes: '', detail: null, critical: false, ...r });
    const v = r.verdict;
    const tag = v === 'PASS' ? green('PASS')
              : v === 'FAIL' ? red(r.critical ? 'FAIL (CRITICAL)' : 'FAIL')
              : v === 'SKIPPED' ? yellow('SKIPPED')
              : yellow('SUSPECT');
    log(`  ${bold(r.id.padEnd(10))} ${tag}  ${r.desc}`);
    if (r.notes) log(dim('             ' + r.notes));
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — the five security tests
// ─────────────────────────────────────────────────────────────────────────────

async function phaseTwo(fx) {
    head('PHASE 2 — THE FIVE TESTS');

    // ── T1 — edit another student's listing ────────────────────────────────
    const t1 = await api(UPDATE_VERB, `/api/products/${fx.OTHER}`, {
        token: fx.a.token, body: { title: 'HACKED' },
    });
    if (t1.status === 404) {
        // Not a pass and not the same failure: a 404 says our fixture id never
        // reached the handler, so the ownership branch was never exercised.
        record({
            id: 'T1', desc: `${UPDATE_VERB} /api/products/:other as A`,
            expected: '403 FORBIDDEN', status: t1.status, code: errorCode(t1),
            verdict: 'SUSPECT', detail: t1.text,
            notes: 'Got 404 — the fixture id did not resolve, so the ownership check was never reached. Not a pass.',
        });
    } else {
        const ok = t1.status === 403 && errorCode(t1) === 'FORBIDDEN';
        record({
            id: 'T1', desc: `${UPDATE_VERB} /api/products/:other as A`,
            expected: '403 FORBIDDEN', status: t1.status, code: errorCode(t1),
            verdict: ok ? 'PASS' : 'FAIL', critical: !ok, detail: ok ? null : t1.text,
        });
    }

    // ── T2 — delete another student's listing ──────────────────────────────
    const t2 = await api('DELETE', `/api/products/${fx.OTHER}`, { token: fx.a.token });
    const t2ok = t2.status === 403 && errorCode(t2) === 'FORBIDDEN';
    record({
        id: 'T2', desc: 'DELETE /api/products/:other as A',
        expected: '403 FORBIDDEN', status: t2.status, code: errorCode(t2),
        verdict: t2ok ? 'PASS' : 'FAIL', critical: !t2ok, detail: t2ok ? null : t2.text,
    });

    // ── T2-verify — the row must still be there, untouched ─────────────────
    // Existence is asserted explicitly: a 403 that nonetheless deleted the row
    // would sail through a title-only check.
    const t2rows = sql(`select id, title from public.products where id = ${q(fx.OTHER)}`);
    const exists  = t2rows.length === 1;
    const titleOk = exists && t2rows[0][1] === 'BLOCKF_OTHER';
    record({
        id: 'T2-verify', desc: 'BLOCKF_OTHER still exists and is unchanged',
        expected: 'row present, title BLOCKF_OTHER', status: '—',
        code: exists ? `title=${t2rows[0][1]}` : 'ROW MISSING',
        verdict: exists && titleOk ? 'PASS' : 'FAIL', critical: true,
        detail: exists ? null : 'select returned zero rows — the listing was destroyed',
    });

    // ── T3 — like across campus ────────────────────────────────────────────
    // The exact code matters: a generic FORBIDDEN is a FAIL, because the UI has
    // to tell this case apart from an ownership rejection.
    const t3 = await api('POST', `/api/products/${fx.NIET}/like`, { token: fx.a.token });
    const t3code = errorCode(t3);
    const t3ok = t3.status === 403 && t3code === 'CROSS_CAMPUS_INTERACTION_BLOCKED';
    record({
        id: 'T3', desc: 'POST /api/products/:niet/like as A',
        expected: '403 CROSS_CAMPUS_INTERACTION_BLOCKED', status: t3.status, code: t3code,
        verdict: t3ok ? 'PASS' : 'FAIL', critical: !t3ok, detail: t3ok ? null : t3.text,
        notes: (!t3ok && t3.status === 403 && t3code === 'FORBIDDEN')
            ? 'Blocked, but with the generic code — the client cannot distinguish this case.'
            : '',
    });

    // ── T4 — like as someone else ──────────────────────────────────────────
    // The stray body value must be ignored in silence, not rejected: a 400
    // would tell an attacker the parameter used to work.
    const t4 = await api('POST', `/api/products/${fx.OTHER}/like`, {
        token: fx.a.token, body: { user_id: fx.b.uuid },
    });
    const t4ok = t4.status === 200;
    record({
        id: 'T4', desc: 'POST /api/products/:other/like as A, body user_id=B',
        expected: '200 (body user_id ignored)', status: t4.status, code: errorCode(t4),
        verdict: t4ok ? 'PASS' : 'FAIL', detail: t4ok ? null : t4.text,
    });

    // ── T4-verify — the real assertion of T4 ───────────────────────────────
    const likeRows = sql(
        `select user_id from public.product_likes where product_id = ${q(fx.OTHER)}`,
    ).map((r) => r[0]);
    const oneRow = likeRows.length === 1;
    const isA    = oneRow && likeRows[0] === fx.a.uuid;
    const noB    = !likeRows.includes(fx.b.uuid);
    record({
        id: 'T4-verify', desc: 'product_likes records A, never B',
        expected: `exactly one row, user_id = ${fx.a.uuid}`, status: '—',
        code: likeRows.length ? likeRows.join(', ') : 'no rows',
        verdict: oneRow && isA && noB ? 'PASS' : 'FAIL', critical: !noB,
        detail: (oneRow && isA && noB) ? null
            : `rows: ${JSON.stringify(likeRows)}\nA=${fx.a.uuid}\nB=${fx.b.uuid}` +
              (!noB ? '\nB was recorded as the actor — the identity hole is OPEN.' : ''),
    });

    // ── T5 — a seller can still edit their own listing ─────────────────────
    // Never skip this one. A security fix that blocks legitimate use is a bug,
    // not a fix, so a failure here is as serious as T1 letting traffic through.
    const t5 = await api(UPDATE_VERB, `/api/products/${fx.OWN}`, {
        token: fx.a.token, body: { title: 'BLOCKF_UPDATED' },
    });
    const t5ok = t5.status === 200;
    record({
        id: 'T5', desc: `${UPDATE_VERB} /api/products/:own as A (legitimate edit)`,
        expected: '200', status: t5.status, code: errorCode(t5),
        verdict: t5ok ? 'PASS' : 'FAIL', critical: !t5ok, detail: t5ok ? null : t5.text,
        notes: t5ok ? '' : 'CRITICAL — the owner cannot edit their own listing. Over-restrictive.',
    });

    const t5title = sqlOne(`select title from public.products where id = ${q(fx.OWN)}`);
    const t5vok = t5title === 'BLOCKF_UPDATED';
    record({
        id: 'T5-verify', desc: 'BLOCKF_OWN title actually changed',
        expected: "title = 'BLOCKF_UPDATED'", status: '—', code: String(t5title),
        verdict: t5vok ? 'PASS' : 'FAIL', critical: !t5vok,
        detail: t5vok ? null : `title is still ${JSON.stringify(t5title)}`,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — the fourth hole (messages)
// ─────────────────────────────────────────────────────────────────────────────
//
// Block F's checklist stops at three holes. CC-6 closes four, and the fourth
// lives in messages.controller.js — so it is tested here.
//
// ⚠️ The task brief names `GET /api/messages?userId=&otherUserId=`. That route
// does not exist. The real read is `GET /api/messages/history` and its params
// are userId / contactId / productId (messages.routes.js:25). Same situation as
// PATCH-vs-PUT above: the route file is authoritative.

const HISTORY_PATH = '/api/messages/history';

async function phaseThree(fx) {
    head('PHASE 3 — THE FOURTH HOLE (messages)');

    // ── T6 — unvalidated params must never reach the .or() filter ──────────
    const qs6 = new URLSearchParams({
        userId: 'notauuid', contactId: 'alsonot', productId: 'alsonot',
    });
    const t6 = await api('GET', `${HISTORY_PATH}?${qs6}`, { token: fx.a.token });

    let t6verdict = 'FAIL';
    let t6notes = '';
    let t6critical = false;
    if (t6.status === 400) {
        t6verdict = 'PASS';
    } else if (t6.status === 200) {
        t6critical = true;
        t6notes = 'CRITICAL — unvalidated params reached the PostgREST .or() filter and returned results.';
    } else if (t6.status === 500) {
        t6notes = 'A 500 means the raw database error leaked instead of a validation response.';
    } else {
        t6notes = `Unexpected status ${t6.status}.`;
    }
    record({
        id: 'T6', desc: `GET ${HISTORY_PATH} with non-uuid params`,
        expected: '400', status: t6.status, code: errorCode(t6),
        verdict: t6verdict, critical: t6critical, notes: t6notes,
        detail: t6verdict === 'PASS' ? null : t6.text,
    });

    // ── T7 — reading a thread you are not part of ──────────────────────────
    // Prefer a conversation that carries a product_id: messages.product_id is
    // ON DELETE SET NULL, and the handler validates productId as a uuid before
    // it checks participation.
    const pair =
        sql(`select sender_id, receiver_id, product_id::text from public.messages
              where sender_id <> ${q(fx.a.uuid)} and receiver_id <> ${q(fx.a.uuid)}
                and product_id is not null limit 1`)[0]
        ?? sql(`select sender_id, receiver_id, '' from public.messages
                 where sender_id <> ${q(fx.a.uuid)} and receiver_id <> ${q(fx.a.uuid)}
                 limit 1`)[0];

    if (!pair) {
        record({
            id: 'T7', desc: 'GET a conversation between two OTHER students',
            expected: '403', status: '—', code: '—', verdict: 'SKIPPED',
            notes: 'No conversation exists in which A is not a participant. Not a pass — nothing was proven.',
        });
        return;
    }

    const [sender, receiver, productId] = pair;
    // A syntactically valid stand-in, only if the thread lost its product. The
    // participation check runs after validation and before the query, so the
    // 403 assertion still holds.
    const useProduct = isUuid(productId) ? productId : '00000000-0000-4000-8000-000000000000';
    const substituted = !isUuid(productId);

    const qs7 = new URLSearchParams({ userId: sender, contactId: receiver, productId: useProduct });
    const t7 = await api('GET', `${HISTORY_PATH}?${qs7}`, { token: fx.a.token });

    const t7ok = t7.status === 403;
    const leaked = t7.status === 200 ? (t7.body?.messages?.length ?? 0) : 0;
    record({
        id: 'T7', desc: 'GET a conversation between two OTHER students',
        expected: '403', status: t7.status, code: errorCode(t7),
        verdict: t7ok ? 'PASS' : 'FAIL', critical: !t7ok,
        notes: (substituted ? 'Thread had a NULL product_id; a valid placeholder uuid was used. ' : '') +
            (t7.status === 200
                ? `CRITICAL — returned ${leaked} message(s). Any conversation is readable by guessing two ids.`
                : ''),
        detail: t7ok ? null
            : `sender ${sender}\nreceiver ${receiver}\nproduct ${useProduct}\n${t7.text}`,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — report
// ─────────────────────────────────────────────────────────────────────────────

function report(fx) {
    head('PHASE 4 — REPORT');

    const cols = [
        ['TEST',       (r) => r.id],
        ['EXPECTED',   (r) => String(r.expected)],
        ['STATUS',     (r) => String(r.status)],
        ['ERROR CODE', (r) => (r.code === null || r.code === undefined ? '—' : String(r.code))],
        ['RESULT',     (r) => r.verdict + (r.critical && r.verdict === 'FAIL' ? ' (CRITICAL)' : '')],
    ];
    const widths = cols.map(([h, get]) =>
        Math.max(h.length, ...results.map((r) => get(r).length)));

    const line = (cells) => '  ' + cells.map((s, i) => s.padEnd(widths[i])).join('  ');
    log('');
    log(bold(line(cols.map(([h]) => h))));
    log(dim('  ' + widths.map((w) => '─'.repeat(w)).join('  ')));
    for (const r of results) {
        const rendered = line(cols.map(([, get]) => get(r)));
        log(r.verdict === 'PASS' ? rendered
            : r.verdict === 'FAIL' ? red(rendered)
            : yellow(rendered));
    }

    const failures = results.filter((r) => r.verdict === 'FAIL');
    const suspect  = results.filter((r) => r.verdict === 'SUSPECT');
    const skipped  = results.filter((r) => r.verdict === 'SKIPPED');

    for (const f of [...failures, ...suspect]) {
        head(`${f.verdict}: ${f.id} — ${f.desc}`);
        log(`  expected : ${f.expected}`);
        log(`  status   : ${f.status}`);
        log(`  code     : ${f.code ?? '—'}`);
        if (f.notes)  log(`  note     : ${f.notes}`);
        if (f.detail) log('  body/sql : ' + String(f.detail).split('\n').join('\n             '));
    }

    if (failures.length || suspect.length) {
        head('FIXTURE STATE (left in place for Studio)');
        const rows = sql(
            `select title, id::text, coalesce(status,''), price::text, seller_id::text
               from public.products where title like ${q(PRODUCT_PREFIX + '%')} order by title`,
        );
        for (const r of rows) {
            log(dim(`  ${r[0].padEnd(14)} ${r[1]}  status=${r[2]} price=${r[3]} seller=${r[4]}`));
        }
        const likes = sql(
            `select p.title, l.user_id::text from public.product_likes l
               join public.products p on p.id = l.product_id
              where p.title like ${q(PRODUCT_PREFIX + '%')}`,
        );
        for (const r of likes) log(dim(`  like ${r[0].padEnd(9)} user_id=${r[1]}`));
        log(dim(`  A = ${fx.a.uuid} (campus ${fx.campusA})`));
        log(dim(`  B = ${fx.b.uuid} (campus ${fx.campusB})`));
    }

    log('');
    log(dim(`  update verb used   : ${UPDATE_VERB} (products.routes.js) — the runbook Block F table says PATCH`));
    log(dim(`  messages route used: GET ${HISTORY_PATH}?userId&contactId&productId (messages.routes.js:25)`));
    log('');

    const passed = results.filter((r) => r.verdict === 'PASS').length;
    const summary = `${passed}/${results.length} passed` +
        (failures.length ? `, ${failures.length} FAILED` : '') +
        (suspect.length ? `, ${suspect.length} suspect` : '') +
        (skipped.length ? `, ${skipped.length} skipped` : '');

    if (failures.length === 0 && suspect.length === 0 && skipped.length === 0) {
        log(green(bold('  ✓ BLOCK F VERIFIED — ' + summary)));
        return 0;
    }
    log(red(bold('  ✗ BLOCK F NOT VERIFIED — ' + summary)));
    if (skipped.length && !failures.length && !suspect.length) {
        log(dim('    (skipped tests prove nothing, so this is not a pass)'));
    }
    log(dim('    Fixtures were left in place. Inspect them, then re-run, or clear with --cleanup.'));
    return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    log(bold('\nBLOCK F VERIFICATION') + dim('  —  docs/PHASE_1_RUNBOOK.md Block F / CC-6'));

    assertLocalDatabase();

    if (process.argv.includes('--cleanup')) {
        detectPsql();
        head('CLEANUP');
        const removed = cleanupFixtures();
        step(green('✓') +
            ` removed ${removed.products} BLOCKF_ product(s) and ${removed.users} blockf account(s)`);
        log('');
        process.exit(0);
    }

    await preconditions();
    const fx = await buildFixtures();
    await phaseTwo(fx);
    await phaseThree(fx);
    process.exit(report(fx));
}

main().catch((e) => {
    log('\n' + red(bold('UNHANDLED ERROR')));
    log(e?.stack || String(e));
    log(red('The suite did not finish. Nothing below the failure point was verified.'));
    process.exit(1);
});
