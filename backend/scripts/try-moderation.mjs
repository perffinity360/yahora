// backend/scripts/try-moderation.mjs
// Runs three sample texts through the moderation check (runbook, checkpoint V-A), then
// times the check with three large photos.
// Run: cd backend && node scripts/try-moderation.mjs

import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { checkContent } from '../src/utils/moderation.js';

// Resolved from this file's location, so it works from any folder (as in seedDemo.js).
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env'),
});

const SAMPLES = [
  'Good morning, campus!',
  'You are such an idiot, nobody likes you',
  'I will hurt you after class tomorrow',
];

// 1264 × 1264 × 3 bytes, stored uncompressed: a 4.8 MB file that exists only in memory.
const NOISE_SIDE = 1264;

function noisePhoto() {
  const raw = { width: NOISE_SIDE, height: NOISE_SIDE, channels: 3 };
  return sharp(randomBytes(NOISE_SIDE * NOISE_SIDE * 3), { raw })
    .png({ compressionLevel: 0 })
    .toBuffer()
    .then((buffer) => ({ buffer, mimetype: 'image/png' }));
}

// A skipped check also says "hold", so it must not pass for a real answer.
const label = ({ outcome, checked }) => `${outcome}${checked ? '' : ' (NOT CHECKED)'}`;

for (const text of SAMPLES) {
  const result = await checkContent({ text, images: [] });
  console.log(`"${text}"  → ${label(result)}`);
}

const photos = await Promise.all([noisePhoto(), noisePhoto(), noisePhoto()]);
const megabytes = (photos[0].buffer.length / 1_000_000).toFixed(1);

const startedAt = performance.now();
const result = await checkContent({ text: '', images: photos });
const elapsed = Math.round(performance.now() - startedAt);
console.log(`3 photos of ${megabytes} MB  → ${label(result)} in ${elapsed} ms`);
