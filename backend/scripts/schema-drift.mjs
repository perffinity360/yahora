#!/usr/bin/env node
// backend/scripts/schema-drift.mjs
// ══════════════════════════════════════════════
// OWNER: VISHWAJEET   —   local ⇄ production drift comparison
// ══════════════════════════════════════════════
//
// READ-ONLY. This script compares two databases and prints the difference. It
// never writes to either one, and it enforces that rather than promising it:
//
//   1. Every session opens with
//        SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
//      so any write reaching the server is refused by Postgres itself
//      ("cannot execute CREATE TABLE in a read-only transaction"), not by a
//      convention in this file.
//   2. assertReadOnlySql() refuses to send any statement that is not a SELECT,
//      WITH or SET before it leaves this process.
//
// Both guards are deliberate belt-and-braces. There are NO automated backups on
// this project (free tier), so a production write is irreversible.
//
// ── The credential ──────────────────────────────────────────────────────────
// The production URL is NEVER hardcoded here and must never be committed. Give
// it to the script one of two ways:
//
//   PROD_DB_URL="postgresql://..."          node backend/scripts/schema-drift.mjs
//   PROD_DB_URL_FILE=/path/outside/the/repo node backend/scripts/schema-drift.mjs
//
// Only the HOST is ever printed. The password is never echoed, never logged and
// never written to the report.
//
// Run with --local-only to skip production entirely.
//
// ── Labelling ───────────────────────────────────────────────────────────────
// Every output line carries LOCAL or PRODUCTION. This exists because two
// hand-run queries during the 2026-08-25 investigation disagreed about whether
// users_select_own existed on production, and neither result recorded which
// database it came from. An unlabelled row is how that happens.
//
//   node backend/scripts/schema-drift.mjs
//   node backend/scripts/schema-drift.mjs --local-only

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// ─────────────────────────────────────────────────────────────────────────────
// Targets
// ─────────────────────────────────────────────────────────────────────────────

// How a human on this Mac reaches the local database. Used for display, and
// used directly when psql is on PATH.
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// The SAME database seen from inside the container. 54322 is a host port
// mapping; inside supabase_db_yahora the server listens on 5432 and
// 127.0.0.1:54322 is the container's own empty loopback. Getting this wrong
// produces "Connection refused" against a database that is plainly running.
const LOCAL_DB_URL_IN_CONTAINER = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

const DB_CONTAINER = 'supabase_db_yahora';

/** Tables under comparison. Order is the report order. */
const TABLES = [
    { schema: 'public',  table: 'users'    },
    { schema: 'public',  table: 'messages' },
    { schema: 'storage', table: 'objects'  },
];

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

const log = (...a) => console.log(...a);
const head = (s) => log('\n' + bold('══ ' + s + ' ' + '═'.repeat(Math.max(0, 70 - s.length))));
const sub  = (s) => log('\n' + bold('── ' + s));

/** LOCAL is cyan, PRODUCTION is yellow, everywhere, always. */
const tag = (label) => (label === 'LOCAL' ? cyan('LOCAL     ') : yellow('PRODUCTION'));

function abort(reason, detail) {
    log('\n' + red(bold('ABORT: ' + reason)));
    if (detail) log(dim(String(detail)));
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only enforcement, in this process, before anything is sent
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN = /\b(insert|update|delete|truncate|create|alter|drop|grant|revoke|comment\s+on|refresh\s+materialized|call|do)\b/i;

function assertReadOnlySql(sqlText) {
    // Strip line comments so a keyword inside a comment cannot trip the guard.
    const stripped = sqlText.replace(/--[^\n]*/g, ' ');
    if (FORBIDDEN.test(stripped)) {
        abort('Refusing to send a non-read-only statement.',
            'This script is read-only by construction. Offending SQL:\n' + sqlText);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL transport — psql inside the local supabase container.
//
// psql is not on PATH on this Mac (established in verify-block-f.mjs), and the
// container already has a client that can dial out to production just as well
// as it can reach the local socket. The connection string is passed through the
// container ENVIRONMENT rather than argv so it does not sit in the process list
// inside the container.
// ─────────────────────────────────────────────────────────────────────────────

const FS = ''; // ASCII unit separator: cannot appear in our data

let transport = null; // 'native' | 'docker'

function detectPsql() {
    try {
        execFileSync('psql', ['--version'], { stdio: 'pipe' });
        transport = 'native';
        return;
    } catch { /* not on PATH */ }

    try {
        execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '--version'], { stdio: 'pipe' });
        transport = 'docker';
        return;
    } catch {
        abort('No psql available.',
            'psql is not on PATH and `docker exec ' + DB_CONTAINER + ' psql` failed.\n' +
            'Start the local stack with `supabase start`, or install the psql client.');
    }
}

/**
 * Run read-only SQL against one target. Returns rows as arrays of strings.
 * The READ ONLY session characteristic is prepended to EVERY call, so it holds
 * even though each invocation is a fresh session.
 */
function sql(target, sqlText) {
    assertReadOnlySql(sqlText);

    const script = 'set session characteristics as transaction read only;\n' + sqlText;
    const args = ['-v', 'ON_ERROR_STOP=1', '-tA', '-F', FS, '-q'];

    // Production is reachable identically from either side; only LOCAL changes
    // meaning depending on where psql runs. See LOCAL_DB_URL_IN_CONTAINER.
    const url = transport === 'docker' ? (target.dockerUrl ?? target.url) : target.url;

    let out;
    try {
        if (transport === 'native') {
            out = execFileSync('psql', [url, ...args], {
                encoding: 'utf8', input: script, stdio: ['pipe', 'pipe', 'pipe'],
            });
        } else {
            out = execFileSync(
                'docker',
                ['exec', '-i', '-e', `PGCONN=${url}`, DB_CONTAINER,
                 'sh', '-c', 'exec psql "$PGCONN" ' + args.map((a) => `'${a}'`).join(' ')],
                { encoding: 'utf8', input: script, stdio: ['pipe', 'pipe', 'pipe'] },
            );
        }
    } catch (e) {
        const stderr = (e.stderr || '').toString().trim();
        throw new Error(`psql failed against ${target.label}:\n  ${stderr || e.message}`);
    }

    return out
        .replace(/^SET\n/, '')
        .replace(/\n+$/, '')
        .split('\n')
        .filter((l) => l !== '' && l !== 'SET')
        .map((l) => l.split(FS));
}

const one = (target, text) => {
    const r = sql(target, text);
    return r.length ? r[0][0] : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

const Q = {
    whoami: `
        select current_user
             || ' @ ' || coalesce(host(inet_server_addr()), 'local-socket')
             || ' | server ' || substring(version() from 'PostgreSQL [0-9.]+');`,

    rls: (schema, table) => `
        select c.relrowsecurity::text, c.relforcerowsecurity::text
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = '${schema}' and c.relname = '${table}';`,

    // pg_policies gives roles as an array and the qual already deparsed to text.
    policies: (schema, table) => `
        select policyname,
               array_to_string(roles, ','),
               cmd,
               coalesce(qual, '(none)'),
               coalesce(with_check, '(none)'),
               permissive
          from pg_policies
         where schemaname = '${schema}' and tablename = '${table}'
         order by policyname;`,

    // aclexplode on relacl is authoritative. information_schema.role_table_grants
    // filters by the querying role's membership and can under-report.
    grants: (schema, table) => `
        select r.rolname, a.privilege_type
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          cross join lateral aclexplode(c.relacl) a
          join pg_roles r on r.oid = a.grantee
         where n.nspname = '${schema}' and c.relname = '${table}'
           and r.rolname in ('anon', 'authenticated')
         order by r.rolname, a.privilege_type;`,

    migrations: `
        select version, coalesce(name, '')
          from supabase_migrations.schema_migrations
         order by version;`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Comparison helpers
// ─────────────────────────────────────────────────────────────────────────────

const MATCH   = green('MATCH');
const DIFFERS = red(bold('DIFFERS'));

const differences = [];

function note(area, detail) {
    differences.push({ area, detail });
}

/** Print one labelled line per target, then a verdict. */
function compareScalar(area, localVal, prodVal, { prodMissing }) {
    log('  ' + tag('LOCAL') + '  ' + (localVal ?? dim('(null)')));
    if (prodMissing) {
        log('  ' + tag('PRODUCTION') + '  ' + dim('(not queried)'));
        return;
    }
    log('  ' + tag('PRODUCTION') + '  ' + (prodVal ?? dim('(null)')));
    const same = String(localVal) === String(prodVal);
    log('  ' + dim('verdict: ') + (same ? MATCH : DIFFERS));
    if (!same) note(area, `LOCAL=${localVal}  PRODUCTION=${prodVal}`);
}

/** Render a set of rows under a label, or an explicit "none" marker. */
function printRows(label, rows, render) {
    if (!rows.length) {
        log('  ' + tag(label) + '  ' + dim('(no rows)'));
        return;
    }
    for (const r of rows) log('  ' + tag(label) + '  ' + render(r));
}

/** Compare two row sets by a stable key, printing both sides fully. */
function compareRowSets(area, localRows, prodRows, { key, render, prodMissing }) {
    printRows('LOCAL', localRows, render);
    if (prodMissing) {
        log('  ' + tag('PRODUCTION') + '  ' + dim('(not queried)'));
        return;
    }
    printRows('PRODUCTION', prodRows, render);

    const lk = new Map(localRows.map((r) => [key(r), render(r)]));
    const pk = new Map(prodRows.map((r) => [key(r), render(r)]));

    const onlyLocal = [...lk.keys()].filter((k) => !pk.has(k));
    const onlyProd  = [...pk.keys()].filter((k) => !lk.has(k));
    const changed   = [...lk.keys()].filter((k) => pk.has(k) && pk.get(k) !== lk.get(k));

    const same = !onlyLocal.length && !onlyProd.length && !changed.length;
    log('  ' + dim('verdict: ') + (same ? MATCH : DIFFERS));

    if (!same) {
        for (const k of onlyLocal) {
            log('    ' + red('LOCAL only:      ') + k);
            note(area, `present on LOCAL only: ${k}`);
        }
        for (const k of onlyProd) {
            log('    ' + red('PRODUCTION only: ') + k);
            note(area, `present on PRODUCTION only: ${k}`);
        }
        for (const k of changed) {
            log('    ' + red('definition differs: ') + k);
            log('      ' + tag('LOCAL') + '  ' + lk.get(k));
            log('      ' + tag('PRODUCTION') + '  ' + pk.get(k));
            note(area, `definition differs for ${k}`);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function resolveProdUrl() {
    if (process.env.PROD_DB_URL) return process.env.PROD_DB_URL.trim();
    if (process.env.PROD_DB_URL_FILE) {
        try {
            return readFileSync(process.env.PROD_DB_URL_FILE, 'utf8').trim();
        } catch (e) {
            abort('PROD_DB_URL_FILE is set but could not be read.', String(e));
        }
    }
    return null;
}

function hostOf(url) {
    try {
        const u = new URL(url);
        return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)} as ${u.username}`;
    } catch {
        return '(unparseable url)';
    }
}

function main() {
    const localOnly = process.argv.includes('--local-only');

    log(bold('\nSCHEMA DRIFT — LOCAL ⇄ PRODUCTION') +
        dim('   read-only; every line is labelled with its database'));

    detectPsql();

    const local = {
        label: 'LOCAL',
        url: LOCAL_DB_URL,
        dockerUrl: LOCAL_DB_URL_IN_CONTAINER,
    };
    let prod = null;

    if (!localOnly) {
        const url = resolveProdUrl();
        if (!url) {
            abort('No production connection string.',
                'Set PROD_DB_URL or PROD_DB_URL_FILE, or pass --local-only.\n' +
                'Do NOT hardcode it in this file — it must never be committed.');
        }
        prod = { label: 'PRODUCTION', url };
    }

    // ── Connection identity, printed before anything is compared ────────────
    head('CONNECTIONS');
    log('  ' + tag('LOCAL') + '  ' + hostOf(local.url));
    log('  ' + tag('LOCAL') + '  ' + one(local, Q.whoami));
    if (prod) {
        log('  ' + tag('PRODUCTION') + '  ' + hostOf(prod.url));
        log('  ' + tag('PRODUCTION') + '  ' + one(prod, Q.whoami));
    } else {
        log('  ' + tag('PRODUCTION') + '  ' + dim('(skipped — --local-only)'));
    }
    log('\n  ' + dim('transport: ') + transport +
        (transport === 'docker' ? dim(`  (psql inside ${DB_CONTAINER})`) : '') +
        '\n  ' + dim('session:   SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY'));

    const prodMissing = !prod;
    const P = (fn) => (prod ? fn() : []);

    // ── schema_migrations ───────────────────────────────────────────────────
    head('supabase_migrations.schema_migrations');
    const lm = sql(local, Q.migrations);
    const pm = P(() => sql(prod, Q.migrations));
    compareRowSets('schema_migrations', lm, pm, {
        key: (r) => r[0],
        render: (r) => `${r[0]}  ${r[1]}`,
        prodMissing,
    });

    // ── per-table ───────────────────────────────────────────────────────────
    for (const { schema, table } of TABLES) {
        const fq = `${schema}.${table}`;
        head(fq);

        sub('relrowsecurity');
        const lr = sql(local, Q.rls(schema, table))[0] || [];
        const pr = P(() => sql(prod, Q.rls(schema, table))[0] || []);
        compareScalar(`${fq} relrowsecurity`, lr[0], pr[0], { prodMissing });

        sub('policies  (name | roles | cmd | qual | with_check)');
        const lp = sql(local, Q.policies(schema, table));
        const pp = P(() => sql(prod, Q.policies(schema, table)));
        compareRowSets(`${fq} policies`, lp, pp, {
            key: (r) => r[0],
            render: (r) =>
                `${bold(r[0])} | roles=${r[1]} | cmd=${r[2]} | qual=${r[3]} | check=${r[4]}`,
            prodMissing,
        });

        sub('grants to anon / authenticated');
        const lg = sql(local, Q.grants(schema, table));
        const pg = P(() => sql(prod, Q.grants(schema, table)));
        compareRowSets(`${fq} grants`, lg, pg, {
            key: (r) => `${r[0]}:${r[1]}`,
            render: (r) => `${r[0]} → ${r[1]}`,
            prodMissing,
        });
    }

    // ── summary ─────────────────────────────────────────────────────────────
    head('SUMMARY OF DIFFERENCES');
    if (!differences.length) {
        log('  ' + green('No differences found in the compared surface.'));
    } else {
        for (const d of differences) {
            log('  ' + red('•') + ' ' + bold(d.area) + dim(' — ') + d.detail);
        }
        log('\n  ' + bold(String(differences.length)) + ' difference(s).');
    }
    log('');
}

try {
    main();
} catch (e) {
    log('\n' + red(bold('UNHANDLED ERROR')));
    log(e?.stack || String(e));
    process.exit(1);
}
