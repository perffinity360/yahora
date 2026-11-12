---
date: 2026-11-11T23:31:56+05:30
author: vishwajeet
phase: "7"
block: "V-D"
for: neeraj
title: "App community ready for T2 (V-D, all three parts)"
---

# App community ready for T2 (V-D, all three parts)

Block V-D is built: CC-V4a, CC-V4b and CC-V4c, on branch `v-d-app-community` (a mobile PR, so no
backend review needed). Only `mobile/` changed, plus two checkpoint texts in the runbook (below).
**Nothing in `backend/`, `frontend/` or `supabase/` changed.** Type check and an Android bundle
pass; checkpoints V-D4a–c on the POCO are still to run.

The app follows `COMMUNITY_SPEC.md` v3.10, the same as your website, so T2 can compare the two
side by side.

## What the app now has

- **A Community tab** between Marketplace and Messages (the app still opens on Marketplace): the
  floating switcher (campus cap · country or Global with its dropdown · Hot · New), the three
  feeds on the doodle wallpaper, frosted cards, `top_replies` under each post with the thread
  line, Show more / Hide replies, and a heart on replies.
- **Reactions:** tapping React opens the quick bar (spec 3.9; never ❤️ by itself), ⊕ opens the
  full picker (`rn-emoji-keyboard` 1.7.0, "Frequently used" kept on the phone), and the summary
  opens the breakdown sheet.
- **Posting:** the closed composer is a solid dock at the bottom (spec 3.10). Tapping it opens a
  full-screen compose page with the destination chip, up to 3 photos or one GIF, and every
  result of spec §2.3 (nudge dialog, held toast, support card, inline limits). 💬 in a feed opens
  it as a reply. Half-written posts are kept while the app is open.
- **The post page** (`app/post/[id].tsx`): replies 20 at a time behind Load more replies, a reply
  bar, the view-only line on another country's post, and the four "gone" texts of runbook §1.7.
- **⋯ menu:** Report (the spec §7 form, word for word as your `useReport.js`) and Delete.
- **Profiles:** a Posts tab after Watchlist on your own Dashboard, a Posts section on public
  profiles, with your own `Being checked` / `Under review` labels and the support card.
- **The "new posts" pill** on Campus, by your spec §8 rules: counts from 1 ms after the newest
  post shown, polls every 30 s only while the tab is on screen and the app open, and its tap adds
  the missing posts on top without reloading.

## For you to know

- **Runbook edits (shared file):** checkpoint V-D4a steps 5–6 now say a tap opens the quick bar;
  checkpoint V-D4c steps 1–2 now say replies come in Hot order and a reply joins the end. Both
  follow spec changes already made; nothing on the website changes.
- **KLIPY, a finding for both platforms:** the app picks GIFs like your `utils/klipy.js` (the
  medium animated WebP as `url`, the small one as `preview_url`) so both store the same thing.
  But WebP isn't always smaller: on 11 Nov one medium WebP was 1.7 MB against a 0.5 MB GIF of the
  same size. Picking whichever of the two has the smaller `size` would help on slow networks. If
  you agree, we change both platforms together; I won't change the app alone.
- **Texts not in the spec**, taken from your website so both say the same thing: "Couldn't delete.
  Try again.", "Couldn't load new posts. Try again.", "Photos must be JPEG, PNG or WebP.",
  "You can add up to 3 photos."

## Migrations applied

None in V-D. **But every migration is now on production** (Vishwajeet pushed, 12 Nov), including
`20261111095654_reply_hot_order_hide_reported`, the one my 11 Nov 14:52 entry said was local only:

- Replies have a Hot score, and `get_post_replies()` can answer in Hot order.
- **What you reported now stays hidden on production too:** the feeds, `/by-user`, the thread,
  `top_replies` and the new-posts count all skip it.
- **Hot-ordered replies also need the backend that asks for them** (`p_sort: 'hot'`, on `main`
  since PR #103). The database defaults to oldest first until that build is live on Render, where
  auto-deploy is off. Both clients show replies in whatever order the API sends.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

None new. T2 uses the existing seed: `arjun.mehta` (IIITDM Kurnool), `sneha.gupta` (NIET),
`lena.test` (Germany, for the view-only checks).

## What NOT to do yet

- Not merged yet: all three parts are committed on `v-d-app-community`, and the checkpoints on the
  POCO are still to run. I'll say when the branch is merged.

## Changed on 12 Nov, after review on the phone (app only)

- **Your reaction comes first in the quick bar, like your `900603a`** (`n-d-fix-reply-count`). The
  app does what your `quickBar()` does: your emoji takes the first place, and one picked from ⊕
  pushes the last of the six out, so a tap removes it without searching the picker. **Please
  update `COMMUNITY_SPEC.md` §5.1 on your branch.** Its new line ends "The app keeps the six in
  their fixed order", which is no longer true; "Website and app:" would cover it. I left the spec
  alone so we don't both edit the same line.
- **No more bouncing.** The quick bar, the ⋯ menu (Report / Delete), the country dropdown and the
  report form opened with a springy zoom that overshot. They now fade in and grow from 94% (the
  form from 96%, 8 pt lower) on an ease-out curve, 180–220 ms, out of the button that opened them.
  The React button's "pop" when you choose an emoji is now a 1.2 swell with no spring, and the ⊕
  picker slides up on an ease-out curve (a patch to `rn-emoji-keyboard`). The rule is in
  `mobile/DESIGN.md`, "Motion": nothing that opens bounces. **The website may want the same:** spec
  §5.1 still says the bar "springs up". `frontend/DESIGN.md` isn't changed; that's your call.
- **The switcher's two pills are solid white,** not frosted (`rgba(255,255,255,0.74)`), so posts no
  longer show through them. That's the campus / country pill and the Hot · New pill beside it. The
  new-posts pill and the other floating buttons keep the frosted look.
