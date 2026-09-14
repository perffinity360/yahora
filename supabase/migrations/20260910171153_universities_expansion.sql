-- ============================================================================
-- 013. Universities: the is_active flag, and the core set loaded inactive.
--
-- Two things happen here, and neither one turns a single new campus on:
--
--   1. public.universities gains an `is_active` boolean
--   2. ~100 institutions are inserted, every one of them is_active = false
--
-- WHY A FLAG AT ALL
-- -----------------
-- Until now a row in `universities` WAS the permission. `handle_new_user`
-- assigns a campus by email domain, so the moment a domain exists in this
-- table, anyone holding an address at that domain can sign up and lands
-- inside that campus — sees its listings, messages its students. There was
-- no middle state between "not in the table" and "live".
--
-- That is not a theoretical concern here. On 3 Sep production held
-- `gmail.com` as NIT Delhi's domain and `yahoo.com` as IIT Tirupati's
-- (docs/CHANGELOG.md, blocker 5, since corrected in the dashboard). Every
-- Gmail address on earth was one signup away from being an NIT Delhi
-- student. A single wrong character in this file does the same thing again.
--
-- `is_active` splits the two ideas apart: the row can exist while the domain
-- is still unproven. Bulk-load now, verify at leisure, flip on one at a time.
-- If a domain turns out to be wrong, nothing happened, because nobody could
-- sign up against it.
--
-- WHY THE DEFAULT IS true, WHICH LOOKS BACKWARDS
-- ----------------------------------------------
-- The eight rows already in this table are live, with real students and real
-- listings behind them — 103 users on the demo campus alone. A default of
-- false would deactivate all eight the instant this migration applied, break
-- every existing signup path, and take the investor demo down with it.
-- `default true` means the existing rows are not touched, in the strongest
-- sense: no update statement runs against them at all. New rows opt OUT
-- explicitly instead (see §2).
--
-- WHY on conflict (domain) do nothing ON EVERY INSERT
-- ---------------------------------------------------
-- This migration only ever INSERTs. It never updates or deletes an existing
-- row. The on-conflict clause is what makes that true even when a domain
-- below is already present: the incoming row is dropped silently rather than
-- failing the migration or overwriting what is there. Four domains in the
-- current eight overlap conceptually with the lists below —
-- iith.ac.in (IIT Hyderabad), iittp.ac.in (IIT Tirupati),
-- nitdelhi.ac.in (NIT Delhi), iiitk.ac.in (IIITDM Kurnool) — and are
-- deliberately absent from them for that reason. The clause is the second
-- line of defence, not the first.
--
-- 'Yahora University (Demo)' / 'demo.yahora.com' is not in any list below and
-- cannot be reached by any statement in this file.
--
-- WHAT THIS MIGRATION DOES NOT DO
-- -------------------------------
-- It does not enforce the flag. Adding a column that nothing reads changes
-- nothing: every inactive university below still works for signup until the
-- backend checks it. Two backend changes are required and are NOT in this
-- file (Phase 3 runbook CC-3):
--
--   · requestOtp must reject a domain whose row has is_active = false
--   · the supported-campuses endpoint must filter on is_active = true,
--     or ~100 unverified colleges appear in the campus switcher
--
-- It also does not activate anything. Activation is a separate migration,
-- written after the domains are verified per runbook §3.4 (MX record, real
-- website, not a public provider, and a student at that college confirming
-- what their address actually looks like).
--
-- No SECURITY DEFINER functions are created here, so the search_path
-- convention of migration 003 §5 has nothing to apply to.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The is_active column.
-- ---------------------------------------------------------------------------

alter table public.universities
  add column is_active boolean not null default true;

comment on column public.universities.is_active is
  'False means the row exists but the domain is unverified: requestOtp must '
  'reject it and the supported-campuses list must hide it. Defaults true so '
  'that pre-existing rows stay live; every bulk-loaded row sets it false '
  'explicitly and is flipped on only after the domain is verified by hand.';

-- Partial index, not a plain one. Both readers of this column want the same
-- thing — the active rows — and the active set is the minority now that ~100
-- inactive rows are landing below. Indexing only `where is_active = true`
-- keeps the unverified backlog out of the index entirely, so it stays small
-- as more colleges are staged.
--
--   · the supported-campuses list:  where is_active = true
--   · the signup domain check:      where domain = $1 and is_active = true
create index if not exists universities_is_active_idx
  on public.universities (is_active)
  where is_active = true;


-- ---------------------------------------------------------------------------
-- 2. The core set. Every row inactive.
--
-- The `select ..., false from (values ...)` shape is deliberate: it states
-- is_active exactly once per group rather than repeating a literal on each of
-- a hundred lines, where one stray `true` would be invisible in review and
-- would silently open a campus.
--
-- Confidence notes per group say where to look hardest during verification.
-- ---------------------------------------------------------------------------

-- Group 1: IITs. Institute domain = student email domain, very consistent
-- across all of them. Confidence: high.
--
-- IIT Hyderabad (iith.ac.in) and IIT Tirupati (iittp.ac.in) are already in
-- the table and ACTIVE. They are omitted here so this migration cannot touch
-- them; the on-conflict clause would skip them regardless.
insert into public.universities (name, domain, is_active)
select name, domain, false
from (values
  ('IIT Bombay',        'iitb.ac.in'),
  ('IIT Delhi',         'iitd.ac.in'),
  ('IIT Madras',        'iitm.ac.in'),
  -- iitk.ac.in is IIT KANPUR. iiitk.ac.in — THREE i's — is IIITDM Kurnool,
  -- which is already in this table with live students. These are two
  -- different institutes one character apart. Neither is a typo of the
  -- other. Do not "correct" either one into the other: doing so enrols one
  -- institute's students into the other's campus, where they would see its
  -- listings and message its members, and the campus isolation guarantee
  -- fails silently with nobody to report it.
  ('IIT Kanpur',        'iitk.ac.in'),
  ('IIT Kharagpur',     'iitkgp.ac.in'),
  ('IIT Roorkee',       'iitr.ac.in'),
  -- Same one-character hazard as above: iitg.ac.in here is IIT Guwahati;
  -- iiitg.ac.in in Group 3 is IIIT Guwahati. Both are real, both are below.
  ('IIT Guwahati',      'iitg.ac.in'),
  ('IIT BHU Varanasi',  'iitbhu.ac.in'),
  ('IIT Ropar',         'iitrpr.ac.in'),
  ('IIT Mandi',         'iitmandi.ac.in'),
  ('IIT Gandhinagar',   'iitgn.ac.in'),
  ('IIT Jodhpur',       'iitj.ac.in'),
  ('IIT Indore',        'iiti.ac.in'),
  ('IIT Patna',         'iitp.ac.in'),
  ('IIT Bhubaneswar',   'iitbbs.ac.in'),
  ('IIT Palakkad',      'iitpkd.ac.in'),
  ('IIT Dharwad',       'iitdh.ac.in'),
  ('IIT Bhilai',        'iitbhilai.ac.in'),
  ('IIT Goa',           'iitgoa.ac.in'),
  ('IIT Jammu',         'iitjammu.ac.in'),
  ('IIT Dhanbad (ISM)', 'iitism.ac.in')
) as v(name, domain)
on conflict (domain) do nothing;


-- Group 2: NITs. Usually the website domain, but with real exceptions —
-- NIT Trichy is .edu, NITK Surathkal is nitk.ac.in (NOT nitk.edu.in).
-- Confidence: medium-high. VERIFY EACH.
--
-- NIT Delhi (nitdelhi.ac.in) is already in the table and is omitted here for
-- the same reason as the IITs above.
insert into public.universities (name, domain, is_active)
select name, domain, false
from (values
  -- .edu, not .ac.in. This one is a real exception, not a transcription slip.
  ('NIT Tiruchirappalli',     'nitt.edu'),
  -- nitk.ac.in. NOT nitk.edu.in, which is the obvious guess and is wrong.
  ('NIT Karnataka Surathkal', 'nitk.ac.in'),
  ('NIT Warangal',            'nitw.ac.in'),
  ('NIT Calicut',             'nitc.ac.in'),
  ('NIT Rourkela',            'nitrkl.ac.in'),
  ('MNNIT Allahabad',         'mnnit.ac.in'),
  ('MNIT Jaipur',             'mnit.ac.in'),
  ('MANIT Bhopal',            'manit.ac.in'),
  ('SVNIT Surat',             'svnit.ac.in'),
  ('NIT Kurukshetra',         'nitkkr.ac.in'),
  ('NIT Hamirpur',            'nith.ac.in'),
  ('NIT Durgapur',            'nitdgp.ac.in'),
  ('NIT Jamshedpur',          'nitjsr.ac.in'),
  ('NIT Patna',               'nitp.ac.in'),
  ('NIT Silchar',             'nits.ac.in'),
  ('NIT Raipur',              'nitrr.ac.in'),
  ('NIT Agartala',            'nita.ac.in'),
  ('NIT Srinagar',            'nitsri.ac.in'),
  ('NIT Goa',                 'nitgoa.ac.in'),
  ('NIT Meghalaya',           'nitm.ac.in'),
  ('NIT Puducherry',          'nitpy.ac.in'),
  ('NIT Uttarakhand',         'nituk.ac.in'),
  ('NIT Arunachal Pradesh',   'nitap.ac.in'),
  ('NIT Mizoram',             'nitmz.ac.in'),
  ('NIT Manipur',             'nitmanipur.ac.in'),
  ('NIT Nagaland',            'nitnagaland.ac.in'),
  ('NIT Sikkim',              'nitsikkim.ac.in'),
  ('NIT Andhra Pradesh',      'nitandhra.ac.in'),
  ('VNIT Nagpur',             'vnit.ac.in')
) as v(name, domain)
on conflict (domain) do nothing;


-- Group 3: IIITs and GFTIs. More variation, some hyphens.
-- Confidence: medium. VERIFY EACH CAREFULLY.
insert into public.universities (name, domain, is_active)
select name, domain, false
from (values
  -- iiit.ac.in with no suffix letter is IIIT Hyderabad specifically, not a
  -- generic IIIT domain. Every other IIIT below carries a distinguishing
  -- letter or word.
  ('IIIT Hyderabad',       'iiit.ac.in'),
  ('IIIT Delhi',           'iiitd.ac.in'),
  ('IIIT Allahabad',       'iiita.ac.in'),
  -- iiitm.ac.in is GWALIOR (ABV-IIITM). Not Kancheepuram, which is iiitdm.
  ('IIIT Gwalior',         'iiitm.ac.in'),
  ('IIIT Bangalore',       'iiitb.ac.in'),
  ('IIITDM Kancheepuram',  'iiitdm.ac.in'),
  -- Hyphenated. iiitbh.ac.in without the hyphen is a different string and
  -- would lock every student at this institute out of signup.
  ('IIIT Bhubaneswar',     'iiit-bh.ac.in'),
  ('IIIT Lucknow',         'iiitl.ac.in'),
  ('IIIT Vadodara',        'iiitvadodara.ac.in'),
  ('IIIT Una',             'iiitu.ac.in'),
  ('IIIT Kottayam',        'iiitkottayam.ac.in'),
  ('IIIT Sri City',        'iiits.ac.in'),
  ('IIIT Nagpur',          'iiitn.ac.in'),
  -- iiitp.ac.in is IIIT PUNE. iitp.ac.in — two i's — is IIT Patna, in
  -- Group 1. Another one-character pair; see the IIT Kanpur note.
  ('IIIT Pune',            'iiitp.ac.in'),
  ('IIIT Ranchi',          'iiitranchi.ac.in'),
  ('IIIT Dharwad',         'iiitdwd.ac.in'),
  ('IIIT Kalyani',         'iiitkalyani.ac.in'),
  -- IIIT Guwahati. IIT Guwahati is iitg.ac.in, in Group 1.
  ('IIIT Guwahati',        'iiitg.ac.in'),
  ('IIIT Manipur',         'iiitmanipur.ac.in'),
  ('DA-IICT Gandhinagar',  'daiict.ac.in'),
  ('LNMIIT Jaipur',        'lnmiit.ac.in'),
  ('BIT Mesra',            'bitmesra.ac.in'),
  ('IIEST Shibpur',        'iiests.ac.in'),
  ('NSUT Delhi',           'nsut.ac.in'),
  ('DTU Delhi',            'dtu.ac.in'),
  ('IIITDM Jabalpur',      'iiitdmj.ac.in')
) as v(name, domain)
on conflict (domain) do nothing;


-- Group 4: large private universities. These change more often and some use a
-- separate student domain. Confidence: medium. VERIFY EACH.
--
-- ⚠️ THIS IS THE LEAST CERTAIN GROUP IN THE FILE. Private universities
-- restructure their mail more often than the government institutes above,
-- and several of these are known to issue students an address on a SUBDOMAIN
-- — student.<domain>, learner.<domain>, mail.<domain> — while the bare
-- domain belongs to staff or to marketing. Three below already reflect that
-- (learner.manipal.edu, mail.jiit.ac.in, pesu.pes.edu), which is evidence the
-- pattern is common here, not that the others are therefore bare.
--
-- Getting this wrong fails in the quiet direction: if the domain is a staff
-- domain, no student at that college can ever sign up, and nobody reports a
-- bug because there is nothing to report. So for THIS group in particular,
-- an MX lookup and a working website are NOT sufficient evidence — both pass
-- happily for a staff-only domain. Every row here must be confirmed with an
-- actual student at that college, who says what their own address looks
-- like, before it is activated.
insert into public.universities (name, domain, is_active)
select name, domain, false
from (values
  -- Per-campus domain: Goa and Hyderabad students are NOT on this one.
  ('BITS Pilani',          'pilani.bits-pilani.ac.in'),
  ('VIT Vellore',          'vit.ac.in'),
  ('VIT Bhopal',           'vitbhopal.ac.in'),
  ('SRM Institute',        'srmist.edu.in'),
  -- Student-facing subdomain, not manipal.edu.
  ('Manipal Academy of Higher Education', 'learner.manipal.edu'),
  ('Thapar Institute',     'thapar.edu'),
  ('Amity University Noida', 'amity.edu'),
  ('Lovely Professional University', 'lpu.in'),
  ('Christ University',    'christuniversity.in'),
  ('Shiv Nadar University', 'snu.edu.in'),
  ('Ashoka University',    'ashoka.edu.in'),
  -- Student-facing subdomain, not jiit.ac.in.
  ('Jaypee Institute (JIIT) Noida', 'mail.jiit.ac.in'),
  -- Student-facing subdomain, not pes.edu.
  ('PES University',       'pesu.pes.edu'),
  ('RV College of Engineering', 'rvce.edu.in'),
  ('BMS College of Engineering', 'bmsce.ac.in'),
  ('MSRIT Bangalore',      'msrit.edu'),
  ('KIIT Bhubaneswar',     'kiit.ac.in'),
  ('Bennett University',   'bennett.edu.in'),
  ('Chandigarh University', 'cuchd.in'),
  ('Graphic Era University', 'geu.ac.in'),
  ('Delhi University',     'du.ac.in'),
  ('Jamia Millia Islamia', 'jmi.ac.in'),
  -- myamu.ac.in is the student mail domain; amu.ac.in is the main site.
  ('Aligarh Muslim University', 'myamu.ac.in'),
  ('Anna University',      'annauniv.edu'),
  ('Jadavpur University',  'jadavpuruniversity.in'),
  ('Parul University',     'paruluniversity.ac.in')
) as v(name, domain)
on conflict (domain) do nothing;


-- ---------------------------------------------------------------------------
-- 3. International universities. Every row inactive, same as §2.
--
-- Each domain below was confirmed against that institution's own IT /
-- student-services documentation on 2026-09-10. Anything that could not be
-- confirmed that way is a TODO comment in §4, not a row.
--
-- THE TRAILING `-- staff:` COMMENTS ARE A DO-NOT-INSERT LIST.
-- ----------------------------------------------------------
-- At these institutions the bare domain is the STAFF domain, and it is not a
-- superset of the student one — it does not reach students at all. Inserting
-- a staff domain therefore fails in both directions at once: lecturers and
-- administrators could sign up as students of that campus, while the actual
-- students stay locked out with no error anyone would think to report. The
-- staff domain is recorded next to each row precisely so that nobody later
-- "simplifies" student.manchester.ac.uk down to manchester.ac.uk on the
-- reasonable-sounding theory that the shorter one covers more people.
--
-- NO COUNTRY COLUMN EXISTS ON THIS TABLE, and this migration does not add
-- one — the schema is unchanged here. The country therefore lives in the
-- display name, e.g. 'University of Melbourne (Australia)', because the
-- campus switcher renders one flat list: without it a student sees
-- "NIT Patna" and "University of Melbourne" side by side with nothing
-- marking them as different countries. The Indian rows in §2 are left
-- exactly as they are — no country suffix — so this file does not rewrite
-- what is already live. If the switcher ever needs real grouping, that is a
-- country column and a separate migration, not a rename of these rows.
insert into public.universities (name, domain, is_active)
select name, domain, false
from (values
  -- Manchester splits THREE ways: undergraduate, postgraduate, staff. Both
  -- student domains are needed or half the campus is locked out. These are
  -- two rows for one institution on purpose; `name` has no unique constraint
  -- (only `domain` does), so the pair is accepted as written.
  ('University of Manchester - Undergraduate (UK)',
                                  'student.manchester.ac.uk'),  -- staff: manchester.ac.uk
  ('University of Manchester - Postgraduate (UK)',
                                  'postgrad.manchester.ac.uk'), -- staff: manchester.ac.uk

  ('University of Sydney (Australia)',    'uni.sydney.edu.au'), -- staff: sydney.edu.au
  ('University of Melbourne (Australia)', 'student.unimelb.edu.au'), -- staff: unimelb.edu.au
  ('University of Toronto (Canada)',      'mail.utoronto.ca'),  -- staff/faculty: utoronto.ca

  -- UBC student email is OPT-IN: students are eligible for @student.ubc.ca
  -- but must sign up for it. Some UBC students will not have one. Expect
  -- support questions ("my UBC address does not work"), not a security
  -- problem — the domain itself is still students-only.
  ('University of British Columbia (Canada)', 'student.ubc.ca'),

  ('McGill University (Canada)',          'mail.mcgill.ca'),    -- staff, faculty, TAs, postdocs: mcgill.ca
  ('National University of Singapore (Singapore)', 'u.nus.edu'), -- staff: nus.edu.sg

  -- ETH: student.ethz.ch and ethz.ch reach the SAME mailbox, so this is the
  -- one case in this block where the bare domain would technically work. We
  -- use the student form anyway, because ethz.ch also covers staff and the
  -- domain is what we are using to prove someone is a student.
  ('ETH Zurich (Switzerland)',            'student.ethz.ch'),

  ('University of Hong Kong (Hong Kong)', 'connect.hku.hk')     -- staff: hku.hk; graduates: graduate.hku.hk
) as v(name, domain)
on conflict (domain) do nothing;


-- ---------------------------------------------------------------------------
-- 4. NOT INSERTED — universities we want, whose student domain we could not
--    confirm from the institution's own documentation on 2026-09-10.
--
-- These are deliberately comments and not SQL. A commented row cannot lock
-- anybody out and cannot let anybody in, which is the correct behaviour for a
-- domain we are not sure about — unlike a guessed row, which is wrong in one
-- of those two directions and tells you which only after a student is
-- affected. Do not promote any of these into an insert without doing the
-- confirmation the TODO asks for.
-- ---------------------------------------------------------------------------

-- TODO UNSW Sydney: sources conflict. Current UNSW IT says
--   zID@ad.unsw.edu.au; an older university help page says
--   z1234567@student.unsw.edu.au. Ask a UNSW student which one
--   appears as their From address.
-- TODO Technical University of Munich: students get TUM-ID@mytum.de
--   automatically and may also create firstname.lastname@tum.de,
--   but tum.de covers employees too. No students-only domain
--   confirmed.
-- TODO Harvard: college.harvard.edu for undergrads, separate
--   domains per graduate school, harvard.edu for faculty. No single
--   student domain.
-- TODO University of Pennsylvania: school-level domains
--   (seas.upenn.edu, wharton.upenn.edu) alongside upenn.edu.
-- TODO US universities generally (MIT, Stanford, Berkeley, CMU,
--   UCLA, Northwestern, Maryland, and the rest): NOT yet checked
--   one by one against each university's own IT page. Several are
--   known to use student subdomains (andrew.cmu.edu, g.ucla.edu,
--   terpmail.umd.edu, u.northwestern.edu). Verify individually.
-- TODO UK: Glasgow, Birmingham, Edinburgh, Leeds and others — the
--   student.* pattern is common but unconfirmed for each.
-- TODO Australia: Monash, UQ, ANU — student.* pattern likely,
--   unconfirmed.
-- TODO Singapore/Hong Kong: NTU (e.ntu.edu.sg?), HKUST
--   (connect.ust.hk?), CUHK (link.cuhk.edu.hk?) — same pattern as
--   NUS and HKU but not individually confirmed.
-- TODO Europe: TU Delft, KU Leuven, EPFL, KTH, DTU — unconfirmed.
-- TODO Asia: Tsinghua, Peking, University of Tokyo, KAIST, SNU,
--   Technion — unconfirmed.
-- TODO Duke-NUS uses u.duke.nus.edu, a separate domain from NUS.
--   Add only if we specifically want Duke-NUS.


-- ---------------------------------------------------------------------------
-- 5. NEAR-COLLISIONS. Read this before "correcting" any domain in this file.
--
-- These are distinct institutions whose domains differ by a suffix or a
-- couple of characters. The same hazard as iitk.ac.in / iiitk.ac.in in §2,
-- and it resolves the same way: neither string is a typo of the other, so
-- editing one to look like the other silently merges two universities into
-- one campus.
-- ---------------------------------------------------------------------------

-- ntu.edu.sg = Nanyang Technological University, Singapore
-- ntu.ac.uk  = Nottingham Trent University, UK
-- ntu.edu.tw = National Taiwan University
--   Three different universities. None is in this file yet.
-- snu.ac.kr  = Seoul National University, South Korea
-- snu.edu.in = Shiv Nadar University, India (already in Group 4)
--   Two different universities. Never "fix" one into the other.
