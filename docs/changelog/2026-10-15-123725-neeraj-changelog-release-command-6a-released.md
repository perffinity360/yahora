---
date: 2026-10-15T12:37:25+05:30
author: neeraj
phase: "6B"
block: "N-A"
for: vishwajeet
title: "Changelog: release command; 6A released"
---

# Changelog: release command; 6A released

`scripts/changelog.mjs` has a fourth command, `release`. **Phase 6A is released.** Its 18
entries no longer exist as separate files in `docs/changelog/`.

## The command

```
node scripts/changelog.mjs release <phase> --dry-run   # prints what it would write and delete; changes nothing
node scripts/changelog.mjs release <phase>
git add -A docs/changelog
git commit -m "docs(changelog): release phase <phase>"
```

It gathers every entry tagged with that phase into one file,
`docs/changelog/releases/phase-<phase>.md`. The file opens with a table of the entries, then
gives each entry in full, oldest first. Each entry keeps its original file name. Then the
small files are deleted, and git history keeps them. Entries from other phases, and untagged
ones, are left alone.

- `new` and `for` behave exactly as before.
- `recent` changed in two small ways:
  - Its last line now names the release files.
  - With no entries left it prints "No unreleased entries in docs/changelog/." instead of
    stopping.
- The script still has no dependencies. It is the tested copy from
  `docs/runbooks/phase6b/changelog.mjs`, unchanged.
- `docs/changelog/README.md` has a new "Releasing a phase" section.
- Root `CLAUDE.md` has one new sentence in the session-start paragraph.

## The rule: release only at SIGN-OFF

Run `release` only at a phase's sign-off, once both of us have merged everything for it.

A phase can be released once. If `releases/phase-<P>.md` exists, `release <P>` refuses to
run. So a late entry can't join a released phase: tag it with the next phase.

**6B is released at the 6B sign-off** (runbook calendar, Day 18). Until then, keep tagging
entries `--phase 6B`.

## Where 6A's entries are now

[`docs/changelog/releases/phase-6A.md`](releases/phase-6A.md): 18 entries, 76 KB, from
2026-10-01 (N-A) to 2026-10-11 (WRAP-UP). To follow an old reference such as
`2026-10-04-184315`, search that file for it. Each entry has an anchor named after its old
file name.

V-0 (13 Oct) and N-0 (15 Oct) are tagged 6B, so they stay in `docs/changelog/`.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

All runs were on the real entries:
- `release 6A --dry-run` listed 18 deletions plus the release file, and `git status` was the
  same before and after.
- The real run: `git status` shows 1 A (`releases/phase-6A.md`) and 18 D.
- Every non-heading line of the 18 originals appears in the release file.

## What NOT to do yet

- Don't run `release 6B` before sign-off.
- Don't add a 6A-tagged entry. 6A is closed; use 6B.
- Inside `phase-6A.md`, three relative links written for `docs/changelog/` no longer resolve
  from `releases/`. There are two links to `2026-10-04-170506-…md` (both in entry 13) and
  one to `../runbooks/phase6a-vd-production-repair.sql` (entry 15). The text was released
  unedited, as required. Fixing the links is allowed under the README rule, but hasn't been
  done.
