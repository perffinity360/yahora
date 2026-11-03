---
date: 2026-11-03T23:01:01+05:30
author: vishwajeet
phase: "7"
block: "V-B"
for: neeraj
title: "Phase 7 migrations pushed to production"
---

# Phase 7 migrations pushed to production

All four Phase 7 migrations are live on production. Local databases get them from
`supabase db reset`.

| Before the push (Step 1) | Value |
|---|---|
| `posts_rows` | 25 (the runbook expected about 0) |
| `demo_users_to_rename` | 15 |

| After the push (Step 4) | Result | Expected |
|---|---|---|
| `post_columns` | 8 | 8 |
| `has_reactions` | true | true |
| `has_reports` | true | true |
| `message_columns` | 2 | 2 |
| `cron_jobs` | 1 | 1 |
| `settings_rows` | 9 | 9 |
| `demo_left` | 0 | 0 |

Other read-only checks after the push:

- The migration ledger lists all four versions, and the old `posts.image_url` column is gone.
- The latest three runs in `cron.job_run_details` succeeded, five minutes apart. That query wasn't
  filtered by job name.
- `posts_no_author`, `posts_no_campus`, `posts_empty`, `messages_empty` and `real_demo_names` are
  all 0.

Vishwajeet also reports the rest of the block as done: the live site check (Step 5) and
`OPENAI_API_KEY` on Render (Step 6).

**The 25 existing posts:** `seedDemo.js` has exactly 25 persona posts and 15 personas, so these look
like the demo campus's posts, kept and converted by the migration. That's inferred from the counts;
no query has confirmed it yet.

## Migrations applied

To production:

- `20261103053142_community_posts.sql`
- `20261103053143_reactions_and_reports.sql`
- `20261103053144_message_reactions_gifs.sql`
- `20261103053145_demo_usernames.sql`

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None. V-C adds the message and inbox fields.

## Test data

The push renamed the 15 demo personas to `demo.` usernames on production.

## What NOT to do yet

- Don't run `backend/scripts/seedDemo.js` until V-C. It fails with `USERNAME_RESERVED`, as your N-S
  entry found, because the personas' names don't have the `demo.` prefix yet.
- Don't treat demo sign-up as broken until V-C is live: a new demo account gets no name at login,
  and onboarding refuses any name without `demo.`. **Skip for now** still works (runbook §1.14).
