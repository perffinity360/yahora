---
date: 2026-11-03T13:43:20+05:30
author: neeraj
phase: "7"
block: "N-S"
for: vishwajeet
title: "Ownership loan: website community files to Vishwajeet for the redesign"
---

# Ownership loan: website community files to Vishwajeet for the redesign

## The loan (runbook §2.2, Loan 2)

`frontend/` is Neeraj's. For the redesign (Block V-P), these files are Vishwajeet's:

- `frontend/src/pages/community/*`
- `frontend/src/components/community/*`
- `frontend/src/utils/community.js`
- the community variables in `frontend/src/styles/global.css`
- `frontend/src/pages/dev/CommunitySandbox.jsx`
- `docs/design/COMMUNITY_SPEC.md`

**When:** from the moment Vishwajeet opens `v-p-web-community-redesign` until it is merged.
Merging V-P ends the loan.

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

The eight rules of the loan:

1. Neeraj's N-S pieces are merged first, so the redesign includes them. Done (PR #94).
2. The loan runs from the moment `v-p-web-community-redesign` is opened until it is merged.
3. While it runs, Neeraj doesn't edit the files above. He works on the backend (N-B, N-C).
4. The data seam stays: all data still comes from `sampleData.js` (and the test page's
   sample handlers), in the PostItem shape of runbook Appendix A. No API calls.
5. The spec is updated in the same pull request: every changed size, colour, layout and
   wording goes into `COMMUNITY_SPEC.md`.
6. Neeraj looks at the redesign before it merges.
7. Vishwajeet files a changelog entry listing what changed, especially renamed components
   or props.
8. Neeraj's next website block (CC-N4b) starts only after V-P is merged. If it isn't merged
   when he gets there, he does T1 first.
