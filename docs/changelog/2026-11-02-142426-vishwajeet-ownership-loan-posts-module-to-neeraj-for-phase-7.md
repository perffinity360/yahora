---
date: 2026-11-02T14:24:26+05:30
author: vishwajeet
phase: "7"
block: "V-A"
for: neeraj
title: "Ownership loan: posts module to Neeraj for Phase 7"
---

# Ownership loan: posts module to Neeraj for Phase 7

**What is lent:** `backend/src/modules/posts/*`, to Neeraj.

**Until:** Phase 7 sign-off. The SIGN-OFF entry hands it back.

**The rules** (runbook §2.2):

1. Vishwajeet doesn't edit `backend/src/modules/posts/` until sign-off.
2. Neeraj **doesn't change the `OWNER:` banner** in those files. This entry is the record of the
   loan.
3. Every backend PR is still reviewed by the other person: Vishwajeet reviews the posts and reports
   PRs, and Neeraj reviews the shared, messages and auth PRs.
4. **The database stays Vishwajeet's.** If the posts API needs something from the database that
   isn't there, file a "Migration request" entry (`backend/CLAUDE.md` explains how).

`backend/src/modules/reports/` isn't part of the loan: it's already Neeraj's.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

None.

## What NOT to do yet

Don't start the posts API until Block V-B's migrations are merged: the SQL functions it calls don't
exist before then.
