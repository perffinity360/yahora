---
date: 2026-10-13T18:35:50+05:30
author: vishwajeet
phase: "6B"
block: "V-0"
for: neeraj
title: "V-0 setup done; deploy settings"
---

# V-0 setup done; deploy settings

## Deploy settings (V-0 checkpoint step 3)

Vishwajeet checked both dashboards on 13 Oct:

- **Render:** branch `main`, Auto-Deploy **On Commit**.
- **Netlify:** production branch `main`. Branch deploys: **Deploy only the production branch**.

What this means for the go-lives in runbook §2.4:

- **Merging to `main` is the go-live, on both.** The API redeploys by itself after a merge, so
  §2.4 needs no extra "Manual Deploy" step on Render. The website does the same on Netlify.
- **Pushing a block branch deploys nothing.** Netlify builds only `main`, so `n-d-…` and the
  other block branches never reach a URL. Test them locally (runbook §2.6, the `try-m1`
  throwaway branch).
- Deploy previews for pull requests are a separate Netlify setting. It wasn't checked.

## What V-0 changed (branch `v-0-setup`)

- Removed the three stray root files (runbook §0.1):
  - `phase6-design-assets.zip` (1.7 MB). Its contents are already in `docs/design/`. This was
    in commit `592eb56`.
  - `cache.jsx` and `temp.cpp`, both 0 bytes. These are in the follow-up commit that carries
    this entry, because `592eb56` only removed the zip.
- `mobile/`: added `expo-clipboard` `~57.0.2` with `npx expo install`, for message Copy in
  V-E. `package.json` and `package-lock.json` changed.
- `README.md` and `cache.md` stay. The runbook leaves them to the owner.

No backend, frontend or supabase file changed.

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

- Don't push straight to `main`. With these settings every push to `main` is a production
  deploy of both the API and the website.
- Keep the §2.4 merge order exactly. A merge goes live within minutes, so merging N-C before
  N-D means real visitors get `seller: null` on a website that can't handle it yet.
