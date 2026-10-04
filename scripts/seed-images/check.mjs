#!/usr/bin/env node
// Dead-image-link checker for seed data. Node 22, no dependencies.
//
//   node scripts/seed-images/check.mjs            # all four sources
//   node scripts/seed-images/check.mjs catalogue  # only sources whose file name contains "catalogue"
//
// Pulls every http(s) URL out of the seed files and every URL out of catalogue.json,
// requests each one, and fails unless it answers 2xx with an image/* content-type.
// A 429 or 503 is a rate limit, not a dead link: it is retried with backoff first.
// Seed titles with no catalogue.json entry are listed as a warning. They do not fail
// the run, because a title with no good photo is deliberately left out of the catalogue.
// Exit 0 = all pass, 1 = something dead or the catalogue is malformed, 2 = could not run.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCES = [
  'supabase/seed.sql',
  'backend/scripts/seedLocal.js',
  'backend/scripts/seedDemo.js',
  'scripts/seed-images/catalogue.json',
];
const CATALOGUE = SOURCES[3];
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 4;
const RETRIES = 4;
// Wikimedia's User-Agent policy asks for a descriptive agent with a way to reach us.
const USER_AGENT = 'YahoraSeedImageCheck/1.0 (https://github.com/perffinity360/yahora) node';
// The seed scripts also hold the local Supabase URL. It is not an image.
const SKIP_HOSTS = new Set(['127.0.0.1', 'localhost']);

// ---------- extraction ----------

function urlsFromText(text) {
  const out = [];
  for (const m of text.matchAll(/https?:\/\/[^\s'"`<>)\]},]+/g)) {
    let host;
    try { host = new URL(m[0]).hostname; } catch { continue; }
    if (!SKIP_HOSTS.has(host)) out.push(m[0]);
  }
  return out;
}

function urlsFromCatalogue(text, problems) {
  let data;
  try { data = JSON.parse(text); } catch (e) {
    problems.push(`${CATALOGUE}: not valid JSON (${e.message})`);
    return [];
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    problems.push(`${CATALOGUE}: top level must be an object keyed by product title`);
    return [];
  }
  const out = [];
  for (const [title, urls] of Object.entries(data)) {
    if (!Array.isArray(urls) || urls.length === 0 || !urls.every((u) => typeof u === 'string')) {
      problems.push(`${CATALOGUE}: "${title}" must map to a non-empty array of URL strings`);
      continue;
    }
    out.push(...urls);
  }
  return out;
}

// Product titles, read the same way the seeds write them. Used only for the coverage check.
function titlesFromSql(text) {
  const lines = text.split('\n');
  const titles = [];
  let inProducts = false;
  for (let i = 0; i < lines.length; i++) {
    if (/insert into public\.products/i.test(lines[i])) inProducts = true;
    else if (/^\s*insert into/i.test(lines[i])) inProducts = false;
    // A product row opens with "('<id>'," then "'<seller>', '<university>'," then the title.
    if (inProducts && /^\s*'[0-9a-f-]{36}',\s*'[0-9a-f-]{36}',?\s*$/.test(lines[i])) {
      const m = lines[i + 1]?.match(/^\s*'((?:[^']|'')*)',\s*$/);
      if (m) titles.push(m[1].replace(/''/g, "'"));
    }
  }
  return titles;
}

function titlesFromJs(text) {
  return [...text.matchAll(/^\s*title:\s*(['"`])((?:\\.|(?!\1).)*)\1,/gm)]
    .map((m) => m[2].replace(/\\(.)/g, '$1'));
}

// ---------- checking ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(url) {
  const headers = { 'user-agent': USER_AGENT };
  const attempt = async (method) => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: method === 'GET' ? { ...headers, range: 'bytes=0-0' } : headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel().catch(() => {});
    return {
      status: res.status,
      type: res.headers.get('content-type') ?? '',
      retryAfter: Number(res.headers.get('retry-after')) || 0,
    };
  };
  const ok = (r) => r.status >= 200 && r.status < 300 && r.type.toLowerCase().startsWith('image/');
  const limited = (r) => r.status === 429 || r.status === 503;

  let result;
  for (let tries = 0; ; tries++) {
    try {
      result = await attempt('HEAD');
      // Some CDNs refuse or misreport HEAD. A one-byte ranged GET is the tie-breaker.
      if (!ok(result) && !limited(result)) result = await attempt('GET');
    } catch {
      try { result = await attempt('GET'); } catch (e) {
        return { ok: false, status: 'ERR', type: e.cause?.code ?? e.name ?? 'network error' };
      }
    }
    if (!limited(result) || tries >= RETRIES) break;
    await sleep(Math.max(result.retryAfter * 1000, 2000 * 2 ** tries));
  }
  return { ok: ok(result), status: result.status, type: result.type };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}

function table(rows, cols) {
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
  const line = (r) => cols.map((c, i) => String(r[c]).padEnd(widths[i])).join('  ');
  return [line(Object.fromEntries(cols.map((c) => [c, c.toUpperCase()]))),
    widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

// ---------- main ----------

const filters = process.argv.slice(2);
const files = filters.length ? SOURCES.filter((f) => filters.some((x) => path.basename(f).includes(x))) : SOURCES;
if (files.length === 0) {
  console.error(`No source matches ${filters.join(', ')}. Sources: ${SOURCES.join(', ')}`);
  process.exit(2);
}

const problems = [];
const texts = {};
for (const f of SOURCES) {
  try { texts[f] = await readFile(path.join(ROOT, f), 'utf8'); } catch (e) {
    if (files.includes(f)) { console.error(`Cannot read ${f}: ${e.message}`); process.exit(2); }
  }
}

// url -> set of files it appears in
const where = new Map();
for (const f of files) {
  const urls = f === CATALOGUE ? urlsFromCatalogue(texts[f], problems) : urlsFromText(texts[f]);
  console.log(`${f}: ${urls.length} URL(s)`);
  for (const u of urls) {
    if (!where.has(u)) where.set(u, new Set());
    where.get(u).add(f);
  }
}

// Coverage: every seed product title needs a catalogue entry.
const missing = [];
if (texts[CATALOGUE] && files.includes(CATALOGUE)) {
  let catalogue = {};
  try { catalogue = JSON.parse(texts[CATALOGUE]); } catch { /* reported above */ }
  for (const f of SOURCES.slice(0, 3)) {
    if (!texts[f]) continue;
    const titles = f.endsWith('.sql') ? titlesFromSql(texts[f]) : titlesFromJs(texts[f]);
    for (const t of new Set(titles)) if (!(t in catalogue)) missing.push({ title: t, file: f });
  }
}

const urls = [...where.keys()];
console.log(`\nChecking ${urls.length} unique URL(s)…`);
const results = await mapLimit(urls, CONCURRENCY, probe);

const dead = [];
urls.forEach((url, i) => {
  if (!results[i].ok) {
    for (const file of where.get(url)) {
      dead.push({ status: results[i].status, type: results[i].type || '(none)', file, url });
    }
  }
});

let failed = false;
if (problems.length) {
  failed = true;
  console.log(`\n${problems.length} catalogue problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
}
if (missing.length) {
  console.log(`\nWarning: ${missing.length} seed title(s) have no catalogue.json entry ` +
    `(no good photo yet; their seed images stay as they are):\n`);
  console.log(table(missing, ['file', 'title']));
}
if (dead.length) {
  failed = true;
  console.log(`\n${dead.length} dead or non-image URL(s):\n`);
  console.log(table(dead, ['status', 'type', 'file', 'url']));
}

console.log(`\n${urls.length - new Set(dead.map((d) => d.url)).size}/${urls.length} URLs OK · ` +
  `${new Set(dead.map((d) => d.url)).size} dead`);
if (!failed) console.log('All checks passed.');
process.exit(failed ? 1 : 0);
