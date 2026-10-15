---
date: 2026-10-15T11:39:22+05:30
author: vishwajeet
phase: "6B"
block: "V-A"
for: neeraj
title: "Ownership loan: products + share modules to Neeraj for Phase 6B"
---

# Ownership loan: products + share modules to Neeraj for Phase 6B

This is the loan described in `docs/runbooks/PHASE_6B_RUNBOOK.md` §2.2.

- **Neeraj may edit `backend/src/modules/products/*` and `backend/src/modules/share/*`** from
  today (15 Oct) until Phase 6B sign-off, for Blocks **N-C** (privacy and views) and **N-E**
  (Mark-as-Sold endpoints).
- **Neeraj does not change the `OWNER:` banners.** They keep naming Vishwajeet. This entry is
  the record of the loan.
- **Vishwajeet does not edit those files until sign-off.** If a messages or mobile change seems
  to need one, it goes to Neeraj as a request.
- **Every backend PR is still reviewed by the other person** (`backend/CLAUDE.md`). Vishwajeet
  reviews Neeraj's products and share PRs. Neeraj reviews Vishwajeet's messages PRs.
- **N-C is the one exception to "one module per PR"** (runbook §2.2). Its modules carry one rule
  that has to go live at the same moment, so they go in one PR. Say so in its description.
- The modules return to Vishwajeet at sign-off. The SIGN-OFF entry will say so.

The calendar in runbook §2.3 starts the loan on Day 2 (13 Oct). It starts today instead,
because V-A landed late.

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

- Nothing calls viewer.js yet — N-C is the first caller.
