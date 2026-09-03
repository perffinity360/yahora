// backend/scripts/seedLocal.js
/**
 * Yahora Local Seed — test data in the REAL universities, local database only.
 *
 * WHY THIS EXISTS, GIVEN seedDemo.js ALREADY EXISTS
 * -------------------------------------------------
 * seedDemo.js fills ONE tenant — 'Yahora University (Demo)' — with polished
 * content for investor and HR demos, and it is allowed to reach production
 * behind an explicit opt-in because that tenant is isolated and disposable.
 *
 * That makes it useless for the thing this product's whole security model
 * rests on: CAMPUS ISOLATION. You cannot test that a Kurnool student never
 * sees a Noida listing when every seeded row lives in the same university.
 *
 * So this script does the opposite job — it spreads students, listings,
 * likes, saves and messages across EVERY REAL university in the database, so
 * the isolation boundary has something on both sides of it.
 *
 * Run: node backend/scripts/seedLocal.js
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// ─── ENV ─────────────────────────────────────────────────────────────────────
// Resolved against this file's own location, not process.cwd(), so the script
// behaves identically whether it is run from the repo root or from backend/.
// Same fix seedDemo.js carries, and for the same reason: a .env that failed to
// load leaves SUPABASE_URL unset, and the guard below then reports "not local"
// for what is really a working-directory problem.
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env'),
});

// ─── SAFETY GUARD — LOCAL ONLY, AND DELIBERATELY NO OVERRIDE ─────────────────
//
// seedDemo.js has an opt-in (SEED_ALLOW_REMOTE) that lets it reach production.
// THIS SCRIPT HAS NONE, AND THE ABSENCE IS THE POINT — not an oversight, and
// not something to "fix" later.
//
// The difference is what each one writes to. seedDemo.js only ever touches one
// isolated, disposable tenant that exists to be overwritten; the worst a
// mistake there can do is make the demo look wrong. This script writes into
// the REAL universities — the tenants that hold actual students, actual
// listings and actual conversations. There is no version of "seed fake Indian
// names and ₹700 calculators into IIITDM Kurnool's production tenant" that is
// ever correct, so no flag, no env var and no argument can ask for it.
//
// If you find yourself wanting to add an override here, what you actually want
// is a different script.
const url = process.env.SUPABASE_URL || '';
if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
  console.error('\n❌ seedLocal.js is LOCAL ONLY and has no override.');
  console.error('   SUPABASE_URL =', url || '(not set)');
  console.error('   Expected http://127.0.0.1:54321');
  console.error('   This script writes into REAL universities. There is no flag');
  console.error('   to make it run anywhere but the local stack.\n');
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// The demo tenant belongs to seedDemo.js. This script never reads it into its
// working set and never deletes anything inside it.
const DEMO_DOMAIN = 'demo.yahora.com';

// Every account this script creates gets this password, and it is printed in
// the summary so you can actually log in as one of them.
const TEST_PASSWORD = 'LocalSeed123!';

// THE OWNERSHIP MARKER. Every email this script creates ends '+seed@<domain>',
// and that suffix is the ONLY thing that makes a row deletable on re-run.
// Nothing else in the app produces it, so it cannot collide with a real signup
// or with an account you made by hand at 2am to reproduce a bug.
const SEED_MARKER = '+seed@';

/** ISO timestamp N days and H hours in the past. */
const ago = (days = 0, hours = 0) =>
  new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();


// ─── THE SIX STUDENTS ────────────────────────────────────────────────────────
//
// One roster, reused at every university. `handle` is the HAND-WRITTEN part of
// the username — see buildHandle() below for the campus suffix that makes it
// unique, and assertValidHandles() for the check that the result is legal.
//
// HANDLES ARE WRITTEN OUT, NOT GENERATED, so they can be read and checked by
// eye. Current rule (migrations 005 + 009):
//
//     lowercase, 3–25 characters, ^[a-z][a-z0-9._-]*$, and NO TWO OF . _ -
//     ADJACENT ANYWHERE.
//
// Each one below starts with a letter, uses exactly one separator, and ends on
// an alphanumeric — that last property is what guarantees the campus suffix
// cannot create an adjacent pair when it is joined on with a '.'.
//
// Deliberate variety across the three legal separators ('.', '-', '_') so the
// seeded data exercises all of them rather than only the common case.
//
// LENGTH BUDGET: the longest handle here is 12 characters ('imran-sheikh').
// With one '.' joiner that leaves 12 for the campus slug inside the 25-char
// limit, which is what SLUG_MAX_LEN below is derived from. If you add a longer
// handle, SLUG_MAX_LEN must come down to match — assertValidHandles() will
// fail loudly rather than let a 26-character handle reach Postgres.
const STUDENTS = [
  { handle: 'aditya.rao',   name: 'Aditya Rao',    year: '3rd Year', qualification: 'B.Tech Computer Science' },
  { handle: 'neha.iyer',    name: 'Neha Iyer',     year: '2nd Year', qualification: 'B.Tech Electronics'      },
  { handle: 'vikram.das',   name: 'Vikram Das',    year: 'Final Year', qualification: 'B.Tech Mechanical'     },
  { handle: 'sanya.bose',   name: 'Sanya Bose',    year: '1st Year', qualification: 'B.Tech Civil'            },
  { handle: 'imran-sheikh', name: 'Imran Sheikh',  year: '2nd Year', qualification: 'M.Tech Data Science'     },
  { handle: 'divya_menon',  name: 'Divya Menon',   year: '3rd Year', qualification: 'B.Des Product Design'    },
];

const LONGEST_HANDLE = Math.max(...STUDENTS.map((s) => s.handle.length));
const USERNAME_MAX_LEN = 25;                                   // migration 005 §3
const SLUG_MAX_LEN = USERNAME_MAX_LEN - LONGEST_HANDLE - 1;    // -1 for the '.' joiner


// ─── THE EIGHT LISTINGS ──────────────────────────────────────────────────────
//
// Created once per university, so eight real campuses' worth of marketplace.
//
// `sellerIndex` points into STUDENTS, so ownership is spread across the roster
// rather than piled on one account — students 0 and 1 get two listings each,
// everyone else gets one.
//
// CATEGORY values must be exactly the eight in MARKETPLACE_CATEGORIES
// (mobile/src/lib/marketplace.ts); CONDITION values exactly the five in
// MARKETPLACE_CONDITIONS. All eight categories appear once here, so every
// filter chip in the marketplace has something behind it on every campus.
//
// created_at is spread over the four "Posting date" buckets the filter uses —
// today (<1d), week (<7d), month (<30d), older (>=30d).
//
// Titles are deliberately distinct from seedDemo.js's forty. That script skips
// any product whose title already exists, so a shared title would make it
// silently seed less than it reported.
//
// likes_count and comments_count are ABSENT on purpose. trg_update_likes_count
// and trg_update_comments_count maintain them; writing a value here as well
// would double-count.
const PRODUCTS = [
  {
    sellerIndex: 0,
    title: 'Casio FX-991EX Classwiz — barely used',
    description:
      'Picked it up in first year and switched to the college-issued one after a semester. All functions work, screen has no scratches, slide cover included.',
    price: 850.0,
    category: 'Electronics & Tech',
    condition: 'Like New',
    location: 'Boys Hostel, Block A',
    views: 132,
    daysAgo: 0,
    hoursAgo: 4,
  },
  {
    sellerIndex: 1,
    title: 'Study table lamp with adjustable neck — warm white',
    description:
      'Clamps to the edge of a hostel desk so it takes up no surface area. Three brightness levels, USB powered, adapter included.',
    price: 620.0,
    category: 'Furniture & Decor',
    condition: 'Good',
    location: 'Girls Hostel, Block C',
    views: 74,
    daysAgo: 2,
  },
  {
    sellerIndex: 2,
    title: 'Engineering Thermodynamics — P.K. Nag, 6th edition',
    description:
      'Standard text for the third-semester course. Highlighting in the first four chapters, the rest is untouched. Spine is intact.',
    price: 400.0,
    category: 'Books & Study Materials',
    condition: 'Fair',
    location: 'Central Library, Reading Room 2',
    views: 58,
    daysAgo: 11,
  },
  {
    sellerIndex: 3,
    title: 'Decathlon rain jacket — navy, size M',
    description:
      'Bought before monsoon and used maybe four times. Fully waterproof, packs into its own pocket. No tears, zip runs clean.',
    price: 1100.0,
    category: 'Clothing & Accessories',
    condition: 'Like New',
    location: 'Girls Hostel, Block D',
    views: 91,
    daysAgo: 5,
  },
  {
    sellerIndex: 4,
    title: 'Hero Sprint 26T geared cycle with lock',
    description:
      'Rode it to the department and back for two years. Gears shift fine, brakes were replaced in March, tyres have plenty left. D-lock and two keys included.',
    price: 5400.0,
    category: 'Vehicles & Bikes',
    condition: 'Good',
    location: 'Cycle Stand, Academic Block',
    views: 246,
    daysAgo: 41,
  },
  {
    sellerIndex: 5,
    title: 'Prestige 1.5 L electric kettle',
    description:
      'Auto cut-off works, no scaling inside, base and cord in good shape. Selling because the new hostel block gives us a pantry.',
    price: 750.0,
    category: 'Appliances',
    condition: 'Good',
    location: 'Girls Hostel, Block C',
    views: 63,
    daysAgo: 19,
  },
  {
    sellerIndex: 0,
    title: 'Cosco badminton racquets — pair, with shuttles',
    description:
      'Two racquets, one grip slightly worn, plus a tube of six nylon shuttles. Enough to get a doubles game going at the court behind the mess.',
    price: 1350.0,
    category: 'Sports & Fitness',
    condition: 'Fair',
    location: 'Sports Complex, Court 3',
    views: 118,
    daysAgo: 3,
  },
  {
    sellerIndex: 1,
    title: 'Extension board (4 socket) and 3 m USB-C cable',
    description:
      'The two things every hostel room runs out of. Board has a surge switch and all four sockets work; cable is braided and charges at full speed.',
    price: 480.0,
    category: 'Miscellaneous',
    condition: 'Mint',
    location: 'Boys Hostel, Block B',
    views: 39,
    daysAgo: 0,
    hoursAgo: 20,
  },
];

// ─── LIKES AND SAVES ─────────────────────────────────────────────────────────
//
// [studentIndex, productIndex]. Both sides are resolved WITHIN one university,
// so a like never crosses a campus boundary — product_likes and product_saves
// have no university_id column of their own, so isolation there lives entirely
// in which pairs get written. seed.sql §"Layer 3" makes the same point.
//
// No pair may have the student liking or saving their own listing; asserted by
// assertInteractions() before anything is written.
const LIKES = [
  [1, 0], [2, 0], [3, 0],
  [0, 1], [2, 1],
  [4, 2],
  [5, 3],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

const SAVES = [
  [2, 0],
  [3, 1],
  [0, 2],
  [1, 3],
  [5, 4],
  [4, 6],
];

// ─── MESSAGES ────────────────────────────────────────────────────────────────
//
// One conversation per campus: student 1 asking student 0 about listing 0, the
// calculator. `from`/`to` are STUDENTS indices, `productIndex` a PRODUCTS one,
// and both students are on the same campus by construction.
//
// minutesAgo descends so the thread reads in order.
const MESSAGES = [
  { from: 1, to: 0, productIndex: 0, minutesAgo: 190, content: 'Hi! Is the Classwiz still available?' },
  { from: 0, to: 1, productIndex: 0, minutesAgo: 175, content: 'Yes it is. I am in Block A, you can come see it any evening.' },
  { from: 1, to: 0, productIndex: 0, minutesAgo: 160, content: 'Would you take 750 for it?' },
  { from: 0, to: 1, productIndex: 0, minutesAgo: 140, content: 'I can do 800. It still has the cover and the box.' },
  { from: 1, to: 0, productIndex: 0, minutesAgo: 96,  content: 'Done. Is today around 7 alright?' },
  { from: 0, to: 1, productIndex: 0, minutesAgo: 90,  content: 'Works for me. See you at the Block A gate.' },
];


// ─── USERNAME CONSTRUCTION AND VALIDATION ────────────────────────────────────

/**
 * A short, readable, alphanumeric slug for a university, derived from its
 * DOMAIN rather than its name — the domain is already unique in the table and
 * already lowercase-ish, and the name is free text that can change.
 *
 *   iiitk.ac.in           → iiitk
 *   niet.co.in            → niet
 *   nitdelhi.ac.in        → nitdelhi
 *   students.nitdelhi.edu → nitdelhi
 *
 * Generic trailing labels (ac, co, edu, in, …) are dropped and the LAST
 * remaining label is used, which is the institution's own label in every
 * Indian academic domain shape we have. The result is stripped to [a-z0-9], so
 * it can never begin with a separator — that is what makes joining it on with
 * a '.' safe under the "no two separators adjacent" rule.
 */
const GENERIC_DOMAIN_LABELS = new Set([
  'ac', 'co', 'edu', 'org', 'com', 'net', 'gov', 'in', 'uk', 'us',
]);

function universitySlug(domain) {
  const labels = String(domain).toLowerCase().split('.').filter(Boolean);
  const meaningful = labels.filter((l) => !GENERIC_DOMAIN_LABELS.has(l));
  const chosen = meaningful.length ? meaningful[meaningful.length - 1] : labels[0] || '';
  return chosen.replace(/[^a-z0-9]/g, '').slice(0, SLUG_MAX_LEN);
}

/** `aditya.rao` + `iiitk` → `aditya.rao.iiitk` */
const buildHandle = (studentHandle, slug) => `${studentHandle}.${slug}`;

/** `aditya.rao` + `iiitk.ac.in` → `aditya.rao+seed@iiitk.ac.in` */
const buildEmail = (studentHandle, domain) =>
  `${studentHandle}+seed@${String(domain).toLowerCase()}`;

/**
 * Fail fast, here, with a readable message — rather than letting Postgres
 * reject the eleventh insert of a forty-row seed with a raw check violation.
 *
 * Checks the CURRENT rule in full (migrations 005 §3 and 009 §2), plus
 * uniqueness across everything this run intends to write.
 */
function assertValidHandles(accounts) {
  const seen = new Map();

  for (const a of accounts) {
    const h = a.username;
    const bad =
      typeof h !== 'string' || !h                    ? 'missing'
      : h !== h.toLowerCase()                        ? 'must be lowercase'
      : h.length < 3 || h.length > USERNAME_MAX_LEN  ? `must be 3–${USERNAME_MAX_LEN} characters (this one is ${h.length})`
      : !/^[a-z][a-z0-9._-]*$/.test(h)               ? 'must start with a lowercase letter and contain only a–z, 0–9, . _ -'
      : /[._-]{2}/.test(h)                           ? 'must not contain two separators in a row (migration 009)'
      : seen.has(h)                                  ? `collides with ${seen.get(h)}`
      : null;

    if (bad) {
      throw new Error(
        `Invalid seeded username "${h}" for ${a.name} at ${a.domain}: ${bad}`
      );
    }
    seen.set(h, `${a.name} at ${a.domain}`);
  }
}

/** No student may like or save their own listing — that is not a real signal. */
function assertInteractions() {
  for (const [studentIndex, productIndex] of [...LIKES, ...SAVES]) {
    const product = PRODUCTS[productIndex];
    if (!product) throw new Error(`Interaction points at missing product index ${productIndex}`);
    if (!STUDENTS[studentIndex]) throw new Error(`Interaction points at missing student index ${studentIndex}`);
    if (product.sellerIndex === studentIndex) {
      throw new Error(
        `Student ${STUDENTS[studentIndex].handle} would like/save their own listing "${product.title}"`
      );
    }
  }
  for (const m of MESSAGES) {
    if (m.from === m.to) throw new Error('A seeded message has the same sender and receiver');
  }
}

/**
 * Titles must be unique within PRODUCTS, because the insert's returned rows
 * are mapped back to their PRODUCTS index by title. Two identical titles would
 * collapse to one entry and silently misattach every like, save and message
 * that pointed at the second one.
 */
function assertProductTitles() {
  const seen = new Set();
  for (const p of PRODUCTS) {
    if (seen.has(p.title)) {
      throw new Error(`Duplicate product title in PRODUCTS: "${p.title}"`);
    }
    seen.add(p.title);
  }
}


// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Every auth user, paginated. listUsers caps a page at 1000 and silently
 * returns only the first one if you ask for more, so a single call would miss
 * accounts on a database that has been reseeded a few times.
 */
async function listAllAuthUsers() {
  const perPage = 1000;
  const all = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users ?? [];
    all.push(...batch);
    if (batch.length < perPage) return all;
  }
}

const emailDomain = (email) => String(email || '').toLowerCase().split('@')[1] || '';


// ─── MAIN ────────────────────────────────────────────────────────────────────

async function seedLocal() {
  console.log('🌱  Yahora local seed — real universities, local database.\n');

  // ── 1. Read the universities. READ ONLY. ──────────────────────────────────
  // seed.sql owns this table (and courses, and specializations). This script
  // never inserts, updates or deletes a row in any of the three — the ids are
  // looked up, never invented, so the seeded data always points at whatever
  // the migrations and seed.sql actually created.
  const { data: allUniversities, error: uniErr } = await supabase
    .from('universities')
    .select('id, name, domain')
    .order('name');
  if (uniErr) throw uniErr;

  const universities = (allUniversities ?? []).filter(
    (u) => String(u.domain).toLowerCase() !== DEMO_DOMAIN
  );

  if (!universities.length) {
    console.error('❌ No real universities found in the database.');
    console.error('   Only the demo tenant exists, or the table is empty.');
    console.error('   Run `supabase db reset` so seed.sql populates it, then try again.\n');
    process.exit(1);
  }

  const skipped = (allUniversities ?? []).length - universities.length;
  console.log(`🏫  ${universities.length} real universit${universities.length === 1 ? 'y' : 'ies'} found` +
    (skipped ? `, ${skipped} demo tenant skipped (seedDemo.js owns it).` : '.'));
  for (const u of universities) console.log(`      · ${u.name} — ${u.domain}`);
  console.log('');

  // ── 2. Build every account up front, and validate before writing. ─────────
  const plan = universities.map((university) => {
    const slug = universitySlug(university.domain);
    if (!slug) {
      throw new Error(
        `Could not derive a username slug from domain "${university.domain}" ` +
        `(${university.name}). Every seeded handle needs one to stay unique.`
      );
    }
    return {
      university,
      slug,
      accounts: STUDENTS.map((s) => ({
        ...s,
        username: buildHandle(s.handle, slug),
        email: buildEmail(s.handle, university.domain),
        domain: university.domain,
      })),
    };
  });

  const allAccounts = plan.flatMap((p) => p.accounts);
  assertValidHandles(allAccounts);
  assertInteractions();
  assertProductTitles();

  // Two universities whose domains collapse to the same slug would produce the
  // same handles and the second campus would fail on users_username_key
  // mid-write. Catch it here instead, where the message can say why.
  const slugOwners = new Map();
  for (const p of plan) {
    if (slugOwners.has(p.slug)) {
      throw new Error(
        `"${p.university.name}" (${p.university.domain}) and ` +
        `"${slugOwners.get(p.slug).name}" (${slugOwners.get(p.slug).domain}) ` +
        `both reduce to the username slug "${p.slug}". Handles would collide.`
      );
    }
    slugOwners.set(p.slug, p.university);
  }

  // ── 3. Pre-flight: is any handle reserved, or already someone else's? ─────
  // Both are reads. The point is to fail with a sentence you can act on rather
  // than a raw 23505 halfway through the write.
  const wantedHandles = allAccounts.map((a) => a.username);

  const { data: reserved, error: reservedErr } = await supabase
    .from('reserved_usernames')
    .select('username')
    .in('username', wantedHandles);
  if (reservedErr) throw reservedErr;
  if (reserved?.length) {
    throw new Error(
      `These seeded handles are in reserved_usernames: ${reserved.map((r) => r.username).join(', ')}`
    );
  }

  // ── 4. Delete this script's own users, and ONLY those. ───────────────────
  //
  // Two conditions, both required:
  //   a) the email carries the '+seed@' marker this script puts there, and
  //   b) its domain belongs to a real university in the working set.
  //
  // A student who signed up by hand at a real university has no marker, so
  // they survive; anything at the demo tenant fails (b), so seedDemo.js's data
  // survives too. Deleting every user in a real university would be far
  // simpler and would throw away somebody's hand-made test account on every
  // reseed — which is exactly the behaviour worth avoiding.
  //
  // Deleting the auth user is enough. public.users cascades from
  // auth.users.id, and products, messages, product_likes, product_saves,
  // comments and purchases all cascade from public.users. One delete, one
  // chance to get it wrong, instead of six.
  const realDomains = new Set(universities.map((u) => String(u.domain).toLowerCase()));
  const authUsers = await listAllAuthUsers();

  const ours = authUsers.filter((u) => {
    const email = String(u.email || '').toLowerCase();
    if (!email.includes(SEED_MARKER)) return false;
    const domain = emailDomain(email);
    if (domain === DEMO_DOMAIN) return false;   // belt and braces; already excluded above
    return realDomains.has(domain);
  });

  if (ours.length) {
    console.log(`🧹  Removing ${ours.length} account(s) from a previous run of this script...`);
    for (const u of ours) {
      const { error } = await supabase.auth.admin.deleteUser(u.id);
      if (error) throw error;
    }
    console.log('      Their products, messages, likes and saves cascaded away with them.\n');
  } else {
    console.log('🧹  Nothing from a previous run to remove.\n');
  }

  // ── 5. Insert, campus by campus. ─────────────────────────────────────────
  const summary = [];

  for (const { university, accounts } of plan) {
    console.log(`── ${university.name} (${university.domain})`);

    // Students ------------------------------------------------------------
    const userIds = [];
    for (const account of accounts) {
      // Created WITHOUT a password, which is then set by updateUserById below.
      // One call owns the password so there is exactly one place to change it.
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: account.email,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      });
      if (createErr) throw createErr;

      const authUser = created?.user;
      if (!authUser?.id) throw new Error(`No auth user returned for ${account.email}`);

      const { error: pwErr } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: TEST_PASSWORD,
      });
      if (pwErr) throw pwErr;

      // UPSERT, not insert. The on_auth_user_created trigger (migration 005
      // §9) has ALREADY created this public.users row — id, university_id
      // resolved from the email domain, is_profile_complete = false — so a
      // plain insert raises 23505 on the primary key.
      //
      // ignoreDuplicates is spelled out because the two behaviours are
      // opposites and the wrong one is silent: with `true` this becomes DO
      // NOTHING, every student keeps the trigger's blank profile, and the seed
      // still reports success.
      //
      // university_id is written explicitly even though the trigger derives
      // the same value. The trigger swallows its own exceptions by design, so
      // a row can legitimately arrive with university_id NULL; this is what
      // guarantees the campus is right, and campus is the isolation boundary.
      //
      // has_password: true is REQUIRED and is not cosmetic. It is a CACHE of
      // auth.users.encrypted_password (migration 005 §2) and nothing keeps the
      // two in sync — 007's backfill only ever saw rows that existed when it
      // ran. Leave it out and every account here holds a perfectly good
      // password while the flag reads false, and loginWithPassword rejects on
      // that flag before it reaches GoTrue: username and email login are both
      // dead, with a generic error that looks like a wrong password rather
      // than bad seed data.
      const { error: profileErr } = await supabase.from('users').upsert(
        {
          id: authUser.id,
          university_id: university.id,
          full_name: account.name,
          username: account.username,
          year_of_study: account.year,
          qualification: account.qualification,
          bio: `${account.qualification} · ${account.year} · seeded test account`,
          is_profile_complete: true,
          has_password: true,
        },
        { onConflict: 'id', ignoreDuplicates: false }
      );
      if (profileErr) throw profileErr;

      userIds.push(authUser.id);
      console.log(`   👤 ${account.name} — @${account.username}  <${account.email}>`);
    }

    // Products ------------------------------------------------------------
    // university_id is the seller's campus, always. seed.sql calls this the
    // invariant of the product and it is: every products row carries the
    // university of every user it touches.
    const productRows = PRODUCTS.map((p) => ({
      seller_id: userIds[p.sellerIndex],
      university_id: university.id,
      title: p.title,
      description: p.description,
      price: p.price,
      category: p.category,
      image_urls: ['https://placehold.co/600x400'],
      status: 'available',
      location: p.location,
      condition: p.condition,
      views: p.views,
      created_at: ago(p.daysAgo ?? 0, p.hoursAgo ?? 0),
    }));

    const { data: insertedProducts, error: prodErr } = await supabase
      .from('products')
      .insert(productRows)
      .select('id, title');
    if (prodErr) throw prodErr;

    // MAPPED BY TITLE, NOT BY POSITION. LIKES, SAVES and MESSAGES all address
    // a listing by its index in PRODUCTS, so productIds[n] has to be the id of
    // PRODUCTS[n] and nothing else. PostgREST happens to return a multi-row
    // insert in input order today, but that is not a documented guarantee —
    // and if it ever stopped holding, the failure would be silent: every like,
    // save and message would attach to the wrong listing, on a database whose
    // whole purpose is checking that rows land where they belong.
    //
    // Titles are unique within PRODUCTS (asserted by assertProductTitles), so
    // they are a safe key to rebuild the order from.
    const idByTitle = new Map((insertedProducts ?? []).map((p) => [p.title, p.id]));
    const productIds = PRODUCTS.map((p) => {
      const id = idByTitle.get(p.title);
      if (!id) {
        throw new Error(
          `Product "${p.title}" was not returned after insert at ${university.name}`
        );
      }
      return id;
    });
    if (idByTitle.size !== PRODUCTS.length) {
      throw new Error(
        `Expected ${PRODUCTS.length} products at ${university.name}, got ${idByTitle.size}`
      );
    }
    console.log(`   🛍️  ${productIds.length} listings`);

    // Likes and saves -----------------------------------------------------
    const { error: likeErr } = await supabase.from('product_likes').insert(
      LIKES.map(([s, p]) => ({ user_id: userIds[s], product_id: productIds[p] }))
    );
    if (likeErr) throw likeErr;

    const { error: saveErr } = await supabase.from('product_saves').insert(
      SAVES.map(([s, p]) => ({ user_id: userIds[s], product_id: productIds[p] }))
    );
    if (saveErr) throw saveErr;
    console.log(`   ❤️  ${LIKES.length} likes, 🔖 ${SAVES.length} saves`);

    // Messages ------------------------------------------------------------
    const { error: msgErr } = await supabase.from('messages').insert(
      MESSAGES.map((m) => ({
        sender_id: userIds[m.from],
        receiver_id: userIds[m.to],
        university_id: university.id,
        product_id: productIds[m.productIndex],
        content: m.content,
        is_read: m.minutesAgo > 120,
        is_delivered: true,
        created_at: ago(0, m.minutesAgo / 60),
      }))
    );
    if (msgErr) throw msgErr;
    console.log(`   💬 ${MESSAGES.length} messages\n`);

    summary.push({
      university: university.name,
      domain: university.domain,
      students: userIds.length,
      products: productIds.length,
      likes: LIKES.length,
      saves: SAVES.length,
      messages: MESSAGES.length,
    });
  }

  // ── 6. Summary ───────────────────────────────────────────────────────────
  console.log('═'.repeat(72));
  console.log('✅  Local seed complete.\n');
  console.table(summary);

  const totals = summary.reduce(
    (acc, r) => ({
      students: acc.students + r.students,
      products: acc.products + r.products,
      likes: acc.likes + r.likes,
      saves: acc.saves + r.saves,
      messages: acc.messages + r.messages,
    }),
    { students: 0, products: 0, likes: 0, saves: 0, messages: 0 }
  );

  console.log(
    `   Totals: ${totals.students} students · ${totals.products} products · ` +
    `${totals.likes} likes · ${totals.saves} saves · ${totals.messages} messages ` +
    `across ${summary.length} universit${summary.length === 1 ? 'y' : 'ies'}.`
  );
  console.log(`   The demo tenant (${DEMO_DOMAIN}) was left alone — seedDemo.js owns it.\n`);
  console.log(`   🔑 Shared password for every seeded account:  ${TEST_PASSWORD}`);
  console.log('   Log in with the email or the @handle printed above.\n');
  console.log('═'.repeat(72));
}

seedLocal().catch((err) => {
  console.error('\n❌ Seed failed:', err.message || err);
  console.error('   Nothing further was written. Fix the above and re-run —');
  console.error('   this script is idempotent, so a partial run is safe to repeat.\n');
  process.exit(1);
});
