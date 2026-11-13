---
date: 2026-11-13T16:56:17+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "Your new reply first and in view; GIFs without the strip; the app's floating Post button"
---

# Your new reply first and in view; GIFs without the strip; the app's floating Post button

Three owner requests (13 Nov), on branch `v-text-formatting`. `COMMUNITY_SPEC.md` is now **v3.11**, and
its change note at the top lists all three. `npx vite build` and the app's `tsc` pass. Nothing was checked
in a browser or on the phone.

**⚠ I edited your `frontend/` at the owner's request.** Four files; please look at them when you review:

1. **`components/community/PostCard/PostThread.jsx`: your new reply goes first and is scrolled into view.**
   - `addedReplies` now go at the **front**, newest first, in the feed thread (folded and unfolded) and on
     the post page. Before, they went at the end.
   - `ReplyRow` takes a `reveal` prop. The newest added reply gets it, and on mount it runs
     `scrollIntoView({ block: "nearest" })`, smooth unless the user prefers reduced motion.
   - The new `.replyReveal` class in `PostCard.module.css` adds `scroll-margin: 88px 0 120px`, so the
     reply stops clear of the sticky header and the dock.
   - Your header comments that still said "oldest first" now say "in Hot order".
2. **`pages/community/CommunityFeed.jsx`, `onPosted`: a new post scrolls the window to the top on a phone
   too.** Only the laptop's panel scroller did before.
3. **`components/community/PostCard/PostGif.jsx` and `.gif` in `PostCard.module.css`: no strip round a
   GIF.**
   - The frame's tint (`reactionPillBorder`) is gone.
   - The frame starts at KLIPY's width × height, then takes the image's real shape on `load`
     (`naturalWidth/Height`, or `videoWidth/Height`), through `--gif-ratio`. Some renditions come back a
     few pixels off the size KLIPY states, and the tint showed in that gap.
   - Width is `min(100%, 280px, 360px × ratio)`. That replaces `max-height: 360px`, which squeezed tall
     GIFs out of shape. A reply's is the same with 180px.
   - The composer's GIF preview is a cropped 88 px square, so it can't show a strip. I left it alone.

**Only the author sees the new order.** It's their own page's copy, so everyone else keeps the API's Hot
order, and so does the author after a reload. Making it last across reloads, as X does for your own
replies, would need `get_post_replies()` to put the viewer's replies first. That's my side, but not built.

## The app, same round (nothing for you to do)

- **The feed's composer dock is gone.** In its place there's a floating `✏️ Post` pill in the bottom right
  corner (`PostFab`), in the zone's strong colour, with the posts scrolling under it. A half-written post
  puts a dot on the pencil.
- The post page keeps its reply bar, and the view-only line keeps its dock.
- `mobile/DESIGN.md` "Floating chrome" now says: a floating action pill where a screen only needs a way
  into the composer, and a solid dock for a real input field.
- **Your new reply goes first and the screen scrolls to it, on the feed and the post page**
  (`useRevealReply`). A new post already went to the top.
- **GIFs: the same fix,** in the feed and the compose screen's preview.

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

- Not merged yet: on `v-text-formatting`.

## What to check in the browser (1440 and 390 wide)

1. Reply to a post that already has 2 or more replies, from the feed. Your reply should be the first one
   under the post, and the page should scroll just enough to show it, clear of the dock. Do it again on
   the post's own page.
2. At 390 wide, scroll down the feed and post. The page should glide to the top, with your post first.
3. Find a GIF that used to show a pink strip at its top and bottom, or post one. There should be no strip,
   only rounded corners. Check a tall GIF too: it should keep its shape, at most 360 tall.
