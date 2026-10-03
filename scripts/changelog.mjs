#!/usr/bin/env node
// OWNER: Neeraj (Phase 6A, Block N-A)
//
// One changelog file per entry, under docs/changelog/. Adding an entry only ever creates a
// new file, so two people adding entries on the same day can never cause a git conflict.
// See docs/changelog/README.md.
//
//   node scripts/changelog.mjs new <author> "<title>" [--phase P] [--block B] [--for who]
//   node scripts/changelog.mjs recent [N]
//   node scripts/changelog.mjs for <name>
//
// No dependencies: node:fs, node:path, node:url only. Do not add an index file here —
// every entry must stay in a file of its own.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'docs', 'changelog');

const SECTIONS = [
  'Migrations applied',
  'New endpoints',
  'Changed endpoints (BREAKING)',
  'New fields on existing responses',
  'Test data',
  'What NOT to do yet',
];

const USAGE = `Usage:
  node scripts/changelog.mjs new <author> "<title>" [--phase P] [--block B] [--for who]
  node scripts/changelog.mjs recent [N]          newest N entries (default 8)
  node scripts/changelog.mjs for <name>          every entry addressed to <name>`;

function fail(message) {
  console.error(`changelog: ${message}\n\n${USAGE}`);
  process.exit(1);
}

const pad = (n) => String(n).padStart(2, '0');

// Local time with its UTC offset, e.g. 2026-10-01T14:03:22+05:30.
function isoLocal(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
}

// Frontmatter values are written double-quoted so a title may contain ':' or '#'.
const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const data = {};
  if (!match) return data;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) data[kv[1]] = unquote(kv[2]);
  }
  return data;
}

function readEntries() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((file) => {
      const data = parseFrontmatter(fs.readFileSync(path.join(DIR, file), 'utf8'));
      // Fall back to the filename's timestamp if the frontmatter date is missing or broken.
      let time = Date.parse(data.date ?? '');
      if (Number.isNaN(time)) {
        const m = file.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})/);
        time = m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0;
      }
      return { file, time, ...data };
    })
    .sort((a, b) => b.time - a.time || b.file.localeCompare(a.file));
}

function formatLine(e) {
  const date = (e.date ?? '').replace('T', ' ').slice(0, 16) || '????-??-?? ??:??';
  const tags = [
    e.phase && `phase ${e.phase}`,
    e.block && `block ${e.block}`,
    e.for && `for ${e.for}`,
  ].filter(Boolean);
  const tagText = tags.length ? `  [${tags.join(' · ')}]` : '';
  return `${date}  ${(e.author ?? '?').padEnd(10)}  ${e.title ?? '(no title)'}${tagText}  — ${e.file}`;
}

function cmdNew(args) {
  const positional = [];
  const opts = { phase: '', block: '', for: '' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (!(key in opts)) fail(`unknown option ${arg}`);
      const value = args[++i];
      if (value === undefined || value.startsWith('--')) fail(`${arg} needs a value`);
      opts[key] = value.trim();
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) fail('"new" takes exactly two arguments: <author> "<title>"');

  const author = positional[0].trim().toLowerCase();
  const title = positional[1].trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(author)) fail(`author must be letters, digits or "-": ${positional[0]}`);
  if (!title) fail('title is empty');
  if (opts.for) opts.for = opts.for.toLowerCase();

  const slug = slugify(title) || 'entry';
  const now = new Date();
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const file = path.join(DIR, `${stamp}-${author}-${slug}.md`);

  const body = [
    '---',
    `date: ${isoLocal(now)}`,
    `author: ${author}`,
    opts.phase ? `phase: ${quote(opts.phase)}` : 'phase:',
    opts.block ? `block: ${quote(opts.block)}` : 'block:',
    opts.for ? `for: ${opts.for}` : 'for:',
    `title: ${quote(title)}`,
    '---',
    '',
    `# ${title}`,
    '',
    ...SECTIONS.flatMap((s) => [`## ${s}`, '', '']),
  ]
    .join('\n')
    .replace(/\n+$/, '\n');

  fs.mkdirSync(DIR, { recursive: true });
  try {
    // 'wx' refuses to overwrite: an existing entry is never touched by this tool.
    fs.writeFileSync(file, body, { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') fail(`${path.relative(ROOT, file)} already exists — wait a second and retry`);
    throw err;
  }
  console.log(path.relative(process.cwd(), file));
}

function cmdRecent(args) {
  if (args.length > 1) fail('"recent" takes at most one argument: [N]');
  const n = args.length ? Number(args[0]) : 8;
  if (!Number.isInteger(n) || n < 1) fail(`N must be a positive whole number: ${args[0]}`);
  const entries = readEntries().slice(0, n);
  if (!entries.length) {
    console.log('No entries yet in docs/changelog/.');
    return;
  }
  for (const e of entries) console.log(formatLine(e));
}

function cmdFor(args) {
  if (args.length !== 1) fail('"for" takes exactly one argument: <name>');
  const name = args[0].trim().toLowerCase();
  const entries = readEntries().filter((e) => (e.for ?? '').toLowerCase() === name);
  if (!entries.length) {
    console.log(`No entries for "${name}".`);
    return;
  }
  for (const e of entries) console.log(formatLine(e));
}

const [command, ...rest] = process.argv.slice(2);
switch (command) {
  case 'new':
    cmdNew(rest);
    break;
  case 'recent':
    cmdRecent(rest);
    break;
  case 'for':
    cmdFor(rest);
    break;
  case undefined:
  case '-h':
  case '--help':
  case 'help':
    console.log(USAGE);
    break;
  default:
    fail(`unknown command "${command}"`);
}
