// backend/scripts/moderation-benchmark.mjs
// Runs the labelled text samples through checkContent and prints how often the outcome matches
// the label. The labels are one person's judgement, so this compares thresholds; it doesn't
// measure real-world accuracy. Text only: no images are stored or sent.
// Run: cd backend && node scripts/moderation-benchmark.mjs

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { checkContent } from '../src/utils/moderation.js';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../.env'), quiet: true });

const samples = JSON.parse(readFileSync(resolve(here, 'moderation-samples.json'), 'utf8'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const OUTCOMES = ['hold', 'nudge', 'publish'];

// A rate-limited call counts as unchecked, which would skew the counts, so it is retried.
async function check(text) {
  let result;
  for (let attempt = 0; attempt < 5; attempt++) {
    result = await checkContent({ text, images: [] });
    if (result.checked) break;
    await sleep(3000 * (attempt + 1));
  }
  return result;
}

const rows = [];
for (const sample of samples) {
  const { outcome, checked } = await check(sample.text);
  rows.push({ ...sample, got: outcome, checked });
  await sleep(250);
}

console.log(`${rows.length} samples, ${rows.filter((row) => !row.checked).length} not checked`);

console.log('\nAgreement by group (want→got)');
for (const group of new Set(rows.map((row) => row.group))) {
  const inGroup = rows.filter((row) => row.group === group);
  const agreed = inGroup.filter((row) => row.got === row.want).length;
  const counts = {};
  for (const { want, got } of inGroup) counts[`${want}→${got}`] = (counts[`${want}→${got}`] ?? 0) + 1;
  const detail = Object.entries(counts).map(([pair, count]) => `${pair}:${count}`).join('  ');
  console.log(`${group.padEnd(12)} ${`${agreed}/${inGroup.length}`.padEnd(6)} ${detail}`);
}

console.log('\nHeld and published');
for (const want of OUTCOMES) {
  const wanted = rows.filter((row) => row.want === want);
  const counts = OUTCOMES.map((got) => `${got} ${wanted.filter((row) => row.got === got).length}`);
  console.log(`want ${want.padEnd(7)} (${String(wanted.length).padStart(2)}): ${counts.join('  ')}`);
}
const total = OUTCOMES.map((got) => `${got} ${rows.filter((row) => row.got === got).length}`);
console.log(`all          (${rows.length}): ${total.join('  ')}`);
