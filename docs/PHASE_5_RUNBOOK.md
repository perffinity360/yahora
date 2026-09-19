# Phase 5 Runbook — Client Pagination + Responsive & Typography Hardening

**Version 1.0 — 18 September 2026**
**Verified against `main` at commit `fbe3c04`.**

Save as `docs/PHASE_5_RUNBOOK.md` and commit it.

---

## HOW TO READ THIS DOCUMENT

Read PART 0, PART 1 and PART 2 **together, both of you, before anyone writes code.**

Then each of you works from your own two tracks:

| Track | Who | What |
|---|---|---|
| TRACK 1 | Vishwajeet | Manual steps, in blocks, each ending in a checkpoint |
| TRACK 2 | Vishwajeet | Claude Code prompts, one per block, copy-paste them whole |
| TRACK 3 | Neeraj | Manual steps, in blocks |
| TRACK 4 | Neeraj | Claude Code prompts |

**👁️ means a human has to look at something.** A browser, a phone, Supabase Studio, a
terminal. Everything without 👁️ is Claude Code's to verify itself.

**This phase is bigger than Phase 4.** It is sized at **six working days**, not five. I
would rather tell you that now than have it quietly run over. If you need it inside five,
§0.7 says which block to drop and what it costs you.

---

# PART 0 — WHAT I FOUND IN THE REPO

Cloned and read `main` at `fbe3c04`. Everything below is verified against the code, not
carried over from a document.

## 0.1 Phase 4 landed cleanly, and it left good seams

**16 migrations** now, up from 14. The two new ones are `inbox_pagination` and
`suggest_usernames_bounded_topup`.

Both clients already read the new envelope. `frontend/src/pages/marketplace/Marketplace.jsx`
reads `data.items`, and so do `Messages.jsx` and `Dashboard.jsx`. On mobile,
`useMarketplace.ts` unwraps `page.items` and already returns `nextCursor` alongside it.

Better than that, whoever wrote these left notes for this exact phase. From
`mobile/src/hooks/useMarketplace.ts`:

> ⚠ ONE PAGE ONLY. The server now returns at most 20 (max 50) and this hook ignores
> `next_cursor`. [...] which plugs in here, by switching this to `useInfiniteQuery` and
> feeding `next_cursor` back as `?cursor=`. `nextCursor` is returned already so the caller
> can tell whether there is more behind it.

That is exactly where Block V-E goes. The same kind of note sits in `useProductDetail.ts`,
`ProductDetail.jsx` and `Dashboard.jsx`. Phase 5's client work is mostly filling in
sockets that already exist, which is why it is safe to run it alongside the UI work.

**Branches behind `main`:** `infiniper` 1, `neeraj` 5, `vishwajeet` 25. Pull before you
start. You said you have; §V-0 and §N-0 check it anyway, because it costs twenty seconds
and the alternative is a day.

## 0.2 ✅ Neeraj's `search_users` bug is real — and I have finished the audit he asked for

Neeraj's diagnosis is correct in every particular. I read the function and the table
definitions, so you do not need to re-derive it.

`supabase/migrations/20260815061951_usernames.sql:725` declares:

```sql
returns table (
    id              uuid,
    username        text,
    full_name       text,      -- ← column 3
    avatar_url      text,
    university_name varchar,
    is_same_campus  boolean,
    rank            real
)
```

`supabase/migrations/20260808143802_remote_schema.sql:569` defines the table:

```sql
CREATE TABLE public.users (
  id                  uuid                     NOT NULL,
  university_id       uuid,
  full_name           character varying(255),   -- ← not text
  avatar_url          text,
  ...
);
```

**Neeraj asked for columns 1, 2 and 4+ to be checked in the same pass, in case one
mismatch meant more. I have done that. Here is the whole table:**

| # | Declared | Actual selected column | Match? |
|---|---|---|---|
| 1 | `id uuid` | `users.id` — `uuid` | ✅ |
| 2 | `username text` | `users.username` — `text` (added as `text` in migration 005) | ✅ |
| 3 | `full_name text` | `users.full_name` — **`character varying(255)`** | ❌ **this is the 500** |
| 4 | `avatar_url text` | `users.avatar_url` — `text` | ✅ |
| 5 | `university_name varchar` | `universities.name` — `character varying(255)` | ✅ see note |
| 6 | `is_same_campus boolean` | computed comparison — `boolean` | ✅ |
| 7 | `rank real` | `greatest(similarity(), similarity())` — `real` | ✅ |

**Only column 3 is broken.** There is no wider schema drift here. That is a real result
and it means Block V-A is a one-line change, not an investigation.

**The note on column 5.** `universities.name` is `character varying(255)` and the function
declares plain `varchar`. Those are the *same base type* with different length limits, and
PostgreSQL's structure check compares base types, so it passes. It is an inconsistency,
not a bug. Leave it. Changing it would mean touching a working column for tidiness, which
is how working things break.

**Why nobody caught this for a month.** PL/pgSQL type-checks a `return query` when the
function **runs**, not when it is created. So `CREATE OR REPLACE FUNCTION` succeeded, the
migration applied cleanly, `supabase db reset` passed, and the error only appeared the
first time somebody actually searched.

**Is production affected?** Almost certainly yes. The function has been broken since
migration 005 on 15 August, and nothing since has changed its signature — migration 013
(`pin_search_path_remaining_functions`) only pinned `search_path`. **User search has
therefore never worked on any environment, ever.** But "almost certainly" is not
"verified", and I cannot reach your production database from here. Block N-A is Neeraj
checking it against production before you change anything, so the fix is measured against
a known state.

## 0.3 The attached V-R file has gone stale in two places

I read it in full. The diagnosis, the decision in §1 and the testing discipline in §6 are
good and I have kept them nearly unchanged. Two things have moved since 17 September.

**Stale claim 1 — the file says font-scale handling appears zero times.** The part-1 prompt
states:

> There is currently no font-scale handling anywhere in the app -- allowFontScaling and
> maxFontSizeMultiplier appear zero times in mobile/src and mobile/app.

That is no longer true. `maxFontSizeMultiplier` now appears **four times**, all in
`mobile/src/components/ProductCard.tsx`, added by commit `e51f7cb` ("Miscellaneous UI
fixes"). If you run the prompt as written, Claude Code will be working from a false
premise about its own codebase.

**Stale claim 2, and this one matters more — the existing cap does nothing.**
`ProductCard.tsx:40`:

```ts
const DENSE_TEXT_SCALE_CAP = 1.3;
```

Android's **Settings → Display → Font size** slider tops out at about **1.30** on stock
Android. A cap set at 1.30 therefore clamps almost nothing: a student on the largest
standard setting still gets the full 1.30.

It looks like a fix, it reads like a fix in review, and it is not one. That constant is the
reason the stats row still overlaps on the Samsung despite having been "fixed" already.
Block V-B replaces it with a real cap.

**Missing section.** The file's Track 1 opens with *"Complete section 2. Do not skip it"*
and §8 refers to comparing against `pre-VR/` — but **there is no section 2 in the
document**. The baseline-screenshot and device-reset step it points at was never written.
It is now Block V-0 and Block N-0, split across both of you, because it needs all three
phones.

## 0.4 The typography audit — this is the real cause of the clutter

You asked for the app to feel less cluttered and more premium. I counted what is actually
there. Every hardcoded `fontSize` in `mobile/app` and `mobile/src`:

| Size | Times used | | Size | Times used |
|---|---|---|---|---|
| 8 | 3 | | 17 | 6 |
| 9 | 6 | | 18 | 2 |
| 10 | 13 | | 19 | 2 |
| 11 | 33 | | 22 | 4 |
| 12 | 41 | | 23 | 3 |
| 13 | 39 | | 24 | 3 |
| 14 | 31 | | 28 | 4 |
| 15 | 19 | | 30 | 2 |
| 16 | 10 | | 34 | 2 |
| | | | 40 | 1 |

**Twenty distinct font sizes, 223 hardcoded usages.** Another 21 usages correctly read a
theme token.

Meanwhile `mobile/src/theme/index.ts` already defines a scale:

```ts
sizes: { sm: 13, md: 15, lg: 18, xl: 24, xxl: 30 }
```

Five tokens, and the app largely ignores them.

**Two things fall out of this, and they are the whole design problem:**

**First — 22 usages are at 8, 9 or 10 dp.** That is below what anyone can comfortably read
on a phone, and small grey text is the single strongest "cheap app" signal there is. Open
Blinkit or super.money and look for 9dp text. There is none.

**Second — twenty sizes is not a design, it is an accumulation.** When 13, 14 and 15 all
appear on the same screen, nothing reads as more important than anything else, and the eye
has nowhere to rest. That flatness is what "cluttered" actually feels like. A designer
would call it a missing hierarchy.

## 0.5 On "reduce the font and display size by one or two points"

You are half right, and the half you are right about is worth doing. Let me separate the
two words, because they are different things and only one of them is yours to change.

**"Display size" is not yours.** It is an Android setting under **Settings → Display →
Display size**, and it changes the screen's density — how many dp the screen reports. The
app cannot read it meaningfully, cannot change it, and should not try. A student who has
set a larger display size has done so because they want one. What you control is your own
layout, and a layout that survives their setting is the goal.

**"Font size, one or two points" — partly right, and here is the honest split.**

Reducing text does fit more characters on a line. It is not a silly idea. But applied
flatly it makes two things worse:

- The 22 usages already at 8–10dp become unreadable.
- The app gets **denser**, and density is the opposite of premium.

And it does not fix the cropping you are actually seeing, because most of that cropping is
not caused by font size at all. §1.2 has the worked example. `Logitech MX Master 3 Wireless
Mouse` becoming `Wireless Mo..` is a *container* problem — the text has nowhere to go —
and it will still truncate at 12dp, just two characters later.

**So the prescription is a mixed one, and it is Block V-C:**

| What | Direction | Why |
|---|---|---|
| Sizes 8, 9, 10 | **Raise to 11** | Legibility floor. Nothing goes below 11 |
| Sizes 14, 16, 17 | **Lower by 1–2** | This is your instinct, applied where it helps |
| Sizes 19, 23, 30, 34, 40 | **Lower to the scale** | The auth headline is clipped because it is 34dp |
| Twenty sizes | **Collapse to seven** | Hierarchy is what makes it look designed |
| Card stats row: 4 items | **Cut to 2** | The real fix — see below |

**The last row is the one that actually makes it premium.** Your product card currently
shows views, likes, comments *and* a timestamp in one row. Four numbers competing for the
same 150dp. Blinkit shows a price and a delivery time. Zepto shows a price and a weight.
super.money shows an amount and a status. **Premium apps show fewer things, not smaller
things.**

Cutting that row from four items to two fixes the `1350 1 0 09h ago` collision
*permanently*, at any font scale, on any phone, forever — in a way that no amount of
`flexShrink` can. Removing content is the strongest responsive fix available, and it is the
one nobody reaches for first.

## 0.6 Phase 5 scope, settled

The build plan's Phase 5 (line 477) says: infinite scroll on web and mobile, the
back-navigation bug, the `focusManager` decision, and confirming mobile realtime. Your
additions are the V-R block, the typography work and the search fix. All of it is in.

| Block | Owner | What |
|---|---|---|
| V-0 / N-0 | Both | Device reset + baseline screenshots |
| **V-A** | Vishwajeet | `search_users` migration — the 500 |
| **V-B** | Vishwajeet | Real font-scale clamp (V-R part 1) |
| **V-C** | Vishwajeet | Type scale + density pass — the premium work |
| **V-D** | Vishwajeet | The four layout fixes (V-R part 2) |
| **V-E** | Vishwajeet | Mobile infinite scroll |
| **V-F** | Vishwajeet | Back-navigation bug + `focusManager` decision |
| **N-A** | Neeraj | Production search verification, before and after |
| **N-B** | Neeraj | Web infinite scroll — marketplace + comments |
| **N-C** | Neeraj | Web infinite scroll — chat (the hard one) |
| **N-D** | Neeraj | The 30-run device matrix |
| **N-E** | Neeraj | Mobile realtime verification |

**One thing from the build plan is being downgraded to a written decision rather than
work.** `focusManager` — whether to wire TanStack Query's window-focus refetching to React
Native's `AppState`. My recommendation is **do not wire it**, keep the explicit resync, and
write down why: wiring it globally re-runs `GET /products/:id` every time the app comes to
the foreground, which inflates `products.views` — and the build plan already flags that
counter as untrustworthy for Phase 6. Wiring it now would make a Phase 6 problem worse to
solve a problem you do not have. That is fifteen minutes of writing, not a day of work.

## 0.7 If six days is too many

Drop **V-E and N-B/N-C — all the infinite scroll — to Phase 6**, and keep the UI work.

The reasoning: the UI work is what students see the moment they open the app, and it is
what you asked for. Infinite scroll matters only on campuses with more than 20 listings.
Your seed data now covers that case (commit `ceaef02` extended `seed.sql` past 20 listings
for `iiitk.ac.in` and `niet.co.in`), but real campuses at launch will not.

Do not drop it the other way round. Shipping pagination onto an app that clips its own
headlines is the wrong trade.

## 0.8 Your three points, answered

**1. The V-R file.** Read fully, folded in, and corrected in the two places §0.3 names. Its
core judgement — that the goal is "nothing overlaps, nothing is clipped, nothing is
unreachable" rather than pixel parity — is right and I have kept it as the acceptance bar.
I have added the missing section 2, and added the typography work you asked for as its own
block ahead of the layout fixes, because a type scale changes what the layout fixes have to
absorb.

**2. Web and app together from now on.** Noted, and it is not this phase. I have written it
into the SIGN-OFF as a standing rule so it survives into Phase 6, where the first real test
of it is the "Mark as Sold" rework — that one needs a schema change plus UI on both
surfaces, and it is exactly the kind of thing that drifts apart if you build one side
first. Phase 5 stays split by surface because the work genuinely is surface-specific:
mobile has a font-scale problem the web does not have, and the web has a scroll-container
problem mobile does not have.

**3. The search bug.** Confirmed real, fully audited, and the audit Neeraj asked for is
done in §0.2 — only column 3 is affected. It is Block V-A, it goes first, and Neeraj checks
production before and after.

---

# PART 1 — THE CONCEPTS, FROM SCRATCH

Read this even where it looks familiar. The worked examples use your actual numbers.

## 1.1 The three numbers that differ between your three phones

When you write `fontSize: 16` in React Native, three separate things decide what the
student actually sees.

**One: dp, the unit you are writing in.** `dp` means *density-independent pixel*. The whole
point of it is that 16dp is meant to look the same physical size on every screen. The
system multiplies it by the screen's density to get real pixels.

Your POCO is ~386 dpi, so 16dp becomes about 38 physical pixels. The Samsung is ~270 dpi,
so 16dp becomes about 27 pixels. **Different pixels, similar physical size.** That part
works, and you do not have to think about it.

**Two: `fontScale` — Settings → Display → Font size.** This is a multiplier, roughly 0.85
to 1.30, that React Native applies to **every `<Text>` automatically**. You wrote 16; a
phone at 1.30 renders 20.8.

You cannot see this in your own testing unless you check, because it is per-device and
sticky. **Your POCO is set below default.** That is why the bugs are invisible to you and
obvious on the Samsung.

**Three: display size — Settings → Display → Display size.** This changes the screen's
reported density, which changes **how many dp of room you have**. It does *not* scale your
text.

So it is the scissors, not the text:

| Phone | Usable height | Font scale | Effect |
|---|---|---|---|
| POCO X2 | ~873 dp | ~0.9 (yours is reduced) | Everything fits. Looks fine |
| OPPO K14 | ~873 dp | 1.0 | Slightly tighter |
| Samsung A03s | **~800 dp** | 1.0 | **11% wider text in 73 fewer dp** |

That table is the entire bug report in the V-R file.

## 1.2 Why text gets cropped — and why it is rarely the font size

This is the most useful thing in this document. Take the real example.

`Logitech MX Master 3 Wireless Mouse` renders as `Wireless Mo..`

The instinct is "the font is too big." Watch what happens if you shrink it.

Say the card's title area is 150dp wide and the text is 13dp. Roughly 25 characters fit.
The string is 35 characters, so 10 get cut.

Drop the font to 12dp. Now about 27 characters fit. **You have saved two characters.** The
string is still cut. It now reads `X Wireless Mo..` instead of `Wireless Mo..`.

Drop to 11dp — 30 characters. Still cut. And now it is hard to read.

**The font size was never the constraint. The container was.** There are only three real
fixes, and shrinking text is not among them:

1. **Give the text more room.** Let it take space from a neighbour that does not need it.
   That is `flexShrink` and `minWidth: 0` — §1.3.
2. **Let it wrap to a second line.** `numberOfLines={2}`.
3. **Put less in the row.** Drop the neighbour entirely — §1.5.

**When font size *is* genuinely the problem:** when the text is in a container sized to the
text, and the container itself then overflows the screen. The auth headline is this case —
`Keep the story going.` at 34dp on an 800dp-tall, 360dp-wide screen has nowhere to go but
under the settings gear. There, coming down to 28dp is a real fix. That is why §0.5's
prescription lowers the big sizes and raises the small ones rather than moving everything
one way.

## 1.3 `flexShrink` and `minWidth: 0` — why a row overflows

A row in React Native is `flexDirection: 'row'`. The children sit side by side. The
question the layout engine has to answer is: when they do not all fit, who gives up space?

By default, **nobody**. Children are laid out at their natural size and simply overlap or
spill.

**Worked example — your product card stats row.**

```
[ 👁 1350 ] [ ♥ 1 ] [ 💬 0 ]        [ 09h ago ]
```

At font scale 1.0 on the POCO, that row needs about 140dp and has 150dp. Fine.

At font scale 1.0 on the Samsung, the card is narrower — the comment already in your code
notes that the same grid is about 10dp narrower per card on a K14 than a POCO. Now the row
needs 140dp and has 130dp. Ten dp short.

With no shrink instructions, the two groups draw on top of each other, and the student sees
`1350 1 0 09h ago` with no gap. Exactly your bug.

**The fix is two properties.**

```ts
statsGroup: {
  flexShrink: 1,     // "you may give up space if the row is tight"
  minWidth: 0,       // "and you are allowed to become narrower than your content"
}
```

**`minWidth: 0` is the one everyone misses, and without it `flexShrink: 1` often does
nothing.** By default a flex child will not shrink below the width of its content — its
"minimum content size". A row of text says *"I need 140dp, that is my minimum"*, and
`flexShrink` is not allowed to overrule a minimum. Setting `minWidth: 0` removes that floor
and lets the child actually become narrower, at which point the text inside truncates or
wraps like you wanted.

Think of it as two permissions. `flexShrink: 1` is *"you may shrink."* `minWidth: 0` is
*"including below your natural size."* You need both.

The counterpart is `flexShrink: 0`, which means *"never shrink me."* That is what a button
wants. A **Send Code** button that shrinks becomes an unreadable sliver; better that the
input next to it gives up the space.

## 1.4 What a type scale is, and why twenty sizes is the problem

A **type scale** is a short, fixed list of font sizes that an app is allowed to use. Not a
guideline — a list. Four to seven entries, and nothing outside it.

**Why it works.** When sizes are far enough apart, the eye reads the difference instantly
and knows what is important. When 13, 14 and 15 sit on the same screen, the difference is
too small to register as meaning. The reader senses *variation* without *hierarchy*, and
that is precisely the feeling of clutter.

**Worked example.** Take the product card as it is:

```
Logitech MX Master 3 Wireless   ← 14dp
₹2,499                          ← 16dp
Like New                        ← 10dp
👁 1350  ♥ 1  💬 0   09h ago     ← 11dp
```

Four sizes, spanning 10 to 16, with the largest only 1.6× the smallest. Nothing dominates.
Your eye lands nowhere first.

Now with a scale, and — critically — fewer items:

```
₹2,499                          ← 18dp, semibold   ← lands here first
Logitech MX Master 3 Wireless   ← 13dp
Like New · 09h ago              ← 11dp, muted
```

Three sizes. The largest is 1.6× the smallest again, but now they are *far apart in the
list* and one of them is clearly the headline. **The total ink on the card went down and
the readability went up.** That is the whole trick, and it is not about the font being
smaller.

**The proposed scale for Yahora — seven tokens:**

| Token | dp | Replaces today's | Direction |
|---|---|---|---|
| `micro` | 11 | 8, 9, 10 | ⬆ raised — the floor |
| `caption` | 12 | 11, 12 | ⬆ / unchanged |
| `body` | 13 | 13, 14 | unchanged / ⬇ |
| `bodyLg` | 15 | 15, 16 | unchanged / ⬇ |
| `title` | 18 | 17, 18, 19 | ⬇ / unchanged / ⬇ |
| `headline` | 22 | 22, 23, 24 | unchanged / ⬇ / ⬇ |
| `display` | 28 | 28, 30, 34, 40 | unchanged / ⬇ / ⬇ / ⬇ |

Read the Direction column: **everything from 14 upward comes down by one to four points —
your instinct — and everything below 11 comes up.** The app gets airier at the top and
readable at the bottom.

**The floor rule, and it is absolute: nothing below 11dp, ever.** At font scale 0.85 an
11dp label already renders at 9.35dp. There is no room underneath it.

## 1.5 Density versus size — what actually reads as "premium"

You named super.money, Blinkit and Zepto. It is worth being precise about what those apps
are doing, because it is not what it looks like.

They are not using nicer fonts. They are all on some variant of Inter or a system sans,
which is what you already use.

**What they actually do is show less.** A Blinkit product tile carries an image, a name, a
weight, a price and a button. Five things. Your product card carries an image, a title, a
price, a condition badge, a view count, a like count, a comment count, a timestamp, a like
button and a save button. **Ten things, in less space.**

The perceived quality difference is mostly whitespace, and whitespace is what you get when
you remove things.

**Three concrete moves, in order of effect:**

1. **Cut the stats row from four items to two.** Views and comments are seller metrics.
   They belong on the seller's own dashboard, not on every tile in a stranger's feed. Keep
   the condition badge and the timestamp. This single change ends the `1350 1 0 09h ago`
   collision at every font scale on every device.
2. **Let one element dominate.** On a marketplace card that is the price. Make it the
   largest thing on the card and everything else recedes without being made smaller.
3. **Use one accent colour, not five.** You have `purple`, `pink`, `blue`, plus five
   condition colours, plus green and red swipe stamps. Premium interfaces are mostly
   greyscale with one colour used sparingly for the thing you should tap.

Move 1 is in Block V-C. Moves 2 and 3 are judgement calls that need you looking at
screens, so V-C proposes them and you decide from the before/after screenshots.

## 1.6 `useInfiniteQuery` — how paging works on the client

You already use TanStack Query. `useQuery` fetches one thing and holds it.
`useInfiniteQuery` fetches a **list of pages** and holds all of them, with a function that
says how to get the next one.

Three pieces:

```ts
useInfiniteQuery({
  queryKey: ['marketplace', universityId],

  // 1. pageParam is the cursor. undefined on the first page.
  queryFn: ({ pageParam }) => {
    const params = new URLSearchParams({ university_id: String(universityId) });
    if (pageParam) params.append('cursor', pageParam);
    return api.get(`/api/products?${params}`);
  },

  // 2. Where the first page starts: nowhere.
  initialPageParam: undefined,

  // 3. Given the last page, what is the next cursor?
  //    Returning undefined means "there is no more" and stops paging.
  getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
});
```

**What you get back** is `data.pages`, an array of the raw responses — not a flat list. So
the screen has to flatten it:

```ts
const products = data?.pages.flatMap((page) => page.items) ?? [];
```

**Worked example.** Marketplace with 47 listings, limit 20.

| Step | `pageParam` | Server returns | `getNextPageParam` | `data.pages` |
|---|---|---|---|---|
| Open screen | `undefined` | 20 items, `next_cursor: "...T09:00Z"` | `"...T09:00Z"` | 1 page, 20 items |
| Scroll to bottom | `"...T09:00Z"` | 20 items, `next_cursor: "...T06:00Z"` | `"...T06:00Z"` | 2 pages, 40 items |
| Scroll again | `"...T06:00Z"` | 7 items, `next_cursor: null` | `undefined` → stop | 3 pages, 47 items |
| Scroll again | — | no request is made | — | unchanged |

`hasNextPage` becomes `false` at step 4 automatically, because `getNextPageParam` returned
`undefined`. You never track "am I at the end" yourself.

**Triggering the next page.** On mobile, `FlatList` gives you it free:

```tsx
<FlatList
  onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
  onEndReachedThreshold={0.5}   // fire when half a screen from the bottom
/>
```

The `!isFetchingNextPage` guard is not optional. `onEndReached` fires repeatedly while the
user sits near the bottom, and without the guard you will send the same request five times.

On web there is no `onEndReached`. §1.7's sibling pattern is an `IntersectionObserver` on a
sentinel `<div>` at the bottom of the list — a browser API that tells you when an element
scrolls into view. Neeraj's prompt spells it out.

## 1.7 Chat scrolls the other way, and that breaks the normal pattern

Everything else in this phase pages downward. Chat does not, and this is the block most
likely to go wrong on both surfaces.

**A marketplace feed:** newest at the top, you scroll **down**, new pages append to the
**bottom**. `onEndReached` / a bottom sentinel. Easy.

**A chat thread:** oldest at the top, newest at the bottom. You open it **scrolled to the
bottom**. You scroll **up** for older messages. New pages **prepend to the top**.

Three consequences.

**One: the trigger is at the top, not the bottom.** On web that is a sentinel `<div>` at
the top of the scroll container. On mobile the usual answer is `inverted` on the
`FlatList`, which flips it so "the end" is visually the top — and then `onEndReached`
works normally again.

**Two, and this is the one that produces the bug report: scroll position jumps.** Your
container is 2000px of scrollable content and you are at scrollTop 40, near the top.
Twenty older messages load and prepend, adding 1500px above you. The browser keeps
scrollTop at 40 — which is now 1500px further back in the conversation. **The view leaps
backwards and the user loses their place.**

The fix is to measure and compensate:

```js
const before = container.scrollHeight;   // before the new messages render
// ... page prepends ...
const after = container.scrollHeight;
container.scrollTop += (after - before); // put the user back where they were
```

On mobile, `inverted` handles this for you, which is why it is the recommended route.

**Three: the backend already returns the page reversed.** Phase 4's Block N-C queries
descending and reverses before sending, so each page arrives oldest-first, ready to render.
The client must **prepend the whole page as a block**, not append it and re-sort. If either
of you finds yourself sorting messages on the client, something upstream is wrong — stop
and check the backend rather than patching it in the UI.

## 1.8 The PostgreSQL error in Block V-A, in plain terms

`RETURNS TABLE (...)` is a promise. It says: *"when you call me, you will get back exactly
these columns, with exactly these types."*

PostgreSQL enforces that promise at the moment the function runs. Not loosely — exactly. If
you promise `text` and hand back `character varying(255)`, it refuses:

```
42804: Returned type character varying(255) does not match expected type text in column 3
```

**Why it will not just convert.** In most places PostgreSQL happily treats `varchar` and
`text` as interchangeable; they store identically. But a `RETURNS TABLE` structure check is
one of the places where it compares types strictly rather than coercing, because the
declared row type is what every caller has been compiled against. Silently changing the
shape underneath them would be worse than an error.

**The fix, and why it is the one to pick.** Two options exist:

```sql
-- Option A (chosen): keep the promise, make the data match it
select u.id, u.username, u.full_name::text, u.avatar_url, ...
```

```sql
-- Option B (rejected): change the promise to match the data
returns table ( ..., full_name character varying(255), ... )
```

**Option A**, which is what Neeraj recommended and what I agree with. `::text` is a cast —
"treat this value as this type". It is free here, because `varchar` and `text` have the
same internal storage, so nothing is copied or converted.

**Option B is rejected** for a specific reason worth understanding: it welds the function's
signature to a column width. The day someone widens `full_name` to 500 characters, this
function breaks again, in the same invisible way, and nobody will connect the two changes.
Option A keeps the function's promise stable regardless of what the table does underneath.

---

# PART 2 — FILES, OWNERSHIP AND THE DAY-BY-DAY

## 2.1 Every file this phase touches

**Vishwajeet**

```
supabase/migrations/<new>_search_users_full_name_cast.sql   V-A
backend/API.md                                              V-A
mobile/src/components/AppText.tsx          (new)            V-B
mobile/src/components/AppTextInput.tsx     (new)            V-B
mobile/src/theme/index.ts                                   V-B, V-C
mobile/src/components/ProductCard.tsx                       V-B, V-C, V-D
mobile/app/(auth)/login.tsx                                 V-C, V-D
mobile/app/(tabs)/index.tsx                                 V-C, V-D
mobile/app/product/[id].tsx                                 V-C, V-E
mobile/src/hooks/useMarketplace.ts                          V-E
mobile/src/hooks/useProductDetail.ts                        V-E
mobile/src/hooks/useMessages.ts                             V-E
mobile/app/chat/[contactId].tsx                             V-E
mobile/app/_layout.tsx                                      V-F
docs/CHANGELOG.md                                           every block
docs/screenshots/pre-VR/ , post-VR/                         V-0, sign-off
```

**Neeraj**

```
frontend/src/pages/marketplace/Marketplace.jsx              N-B
frontend/src/pages/product/ProductDetail.jsx                N-B
frontend/src/pages/messages/Messages.jsx                    N-C
frontend/src/pages/dashboard/Dashboard.jsx                  N-C
frontend/src/  (wherever user search renders)               N-A
docs/CHANGELOG.md                                           every block
docs/screenshots/pre-VR/ , post-VR/                         N-0, N-D
```

**Nobody touches, this phase or any phase:**

```
backend/src/app.js
backend/src/middleware/
backend/src/config/
backend/src/utils/respond.js
```

## 2.2 Ownership this phase is clean — no loan needed

Phase 4 needed an ownership loan because the pagination lived in Vishwajeet's backend
modules. **Phase 5 needs none.** Every mobile file is Vishwajeet's, every `frontend/` file
is Neeraj's, and the one backend-adjacent item — the `search_users` migration — is SQL,
which only Vishwajeet writes.

The Phase 4 loan **expires now**. Neeraj does not open
`backend/src/modules/products/` or `messages/` in this phase. Block N-A's prompt says so
explicitly, because the habit is one week old and habits stick.

## 2.3 The day-by-day

Six days. The one real dependency is that Neeraj cannot finish N-A until V-A ships.

| Day | Vishwajeet | Neeraj |
|---|---|---|
| **1** | V-0 setup + POCO baseline shots. Then **V-A** — the search migration. Push by end of day | N-0 setup + Samsung and OPPO baseline shots. **N-A part 1** — verify search is broken on production |
| **2** | **V-B** — the real font-scale clamp. Retake shots after | **N-A part 2** — verify the fix. Then **N-B** starts: marketplace infinite scroll |
| **3** | **V-C** — type scale + density pass. The big one | **N-B** — comments infinite scroll |
| **4** | **V-C** finishes. Retake shots | **N-C** — chat infinite scroll (reverse) |
| **5** | **V-D** — the four layout fixes | **N-C** finishes. **N-D** begins: device matrix |
| **6** | **V-E** — mobile infinite scroll. **V-F** — back-nav | **N-D** — matrix finishes. **N-E** — realtime. Joint sign-off |

**Why V-B before V-C before V-D, in that exact order.** The V-R file makes this point and
it is right: *"Do not run part 2 before part 1. The clamp alone may resolve some of the
four, and running them together makes it impossible to tell which change did what."*

The same logic puts the type scale in between. Lowering the auth headline from 34dp to 28dp
may fix FIX 3 outright. If you do the layout surgery first, you will never know which
change earned it, and you will be carrying a `paddingRight` hack forever for no reason.

**Retake the screenshots after V-B and again after V-C.** Three sets, not two. They are
cheap and they are the only way to attribute a fix.

## 2.4 What "done" means for this phase

- 👁️ `GET /api/users/search?q=a` returns results on production. It never has before.
- 👁️ Nothing on any of the three phones is clipped, overlapped or unreachable — at default
  *and* at largest font size.
- No hardcoded `fontSize` outside the seven-token scale. Nothing below 11dp.
- 👁️ Marketplace, comments and chat all load more as you scroll, on web and mobile.
- 👁️ Chat loading older messages does not jump the scroll position.
- 👁️ Back from a product opened via the Dashboard lands on the Dashboard.
- Before and after screenshots committed side by side.

---

# TRACK 1 — VISHWAJEET, MANUAL STEPS

## Block V-0 — Setup and baseline (1 hour)

**This is the missing section 2 from the V-R file. Do not skip it — the rest of the block
is unmeasurable without it.**

First, sync:

```bash
cd ~/path/to/yahora
git checkout main && git pull origin main
git checkout infiniper && git merge main && git push origin infiniper
cd mobile && npm install && cd ..
supabase start && supabase db reset
node backend/scripts/seedLocal.js
node backend/scripts/seedDemo.js
```

### 👁️ The device reset — this invalidates all your previous visual testing

On the **POCO X2**, go to **Settings → Display** and set **both**:

- **Font size** → the default position
- **Display size** → the default position

**Your POCO has been on a reduced font size.** That is not a guess: it is why the same
screens look fine to you and broken to Neeraj. Every screenshot and every "looks good" you
have given on mobile UI was taken at roughly 0.9 scale, which is not what a student sees.

Write down what it was set to before you change it, in the CHANGELOG. If it turns out later
that something only breaks at reduced scale, you will want that number.

### 👁️ The baseline screenshots

Five screens, on the POCO, at default settings:

1. Auth / login
2. Marketplace — grid mode
3. Marketplace — swipe mode
4. Product detail
5. Chat thread, with at least ten messages in it

Save them as `docs/screenshots/pre-VR/poco-01-auth.png` through `poco-05-chat.png`.
Neeraj does the same five on the OPPO and the Samsung in N-0, giving fifteen in total.

**These are the evidence that this phase did anything.** After launch, when someone reports
a device-specific bug, this folder is the first thing to look at.

**👁️ CHECKPOINT V-0.** Confirm three things:

1. `supabase db reset` completed with no error.
2. Both POCO display settings are at default, and the previous font-size value is written
   down.
3. Five screenshots exist in `docs/screenshots/pre-VR/`, and each one is legible enough to
   compare against later.

## Block V-A — The `search_users` migration (half a day, Day 1)

This goes first: Neeraj's N-A is blocked on it, and campus-wide user search has been dead
since 15 August.

**Before you run the prompt**, wait for Neeraj to finish N-A part 1 and post the production
result in the CHANGELOG. You want the fix measured against a known state, not applied to a
guess. It should take him twenty minutes.

Run prompt **CC-V1**.

**What you are checking in the diff.** Claude Code can verify the migration replays. It
cannot tell you whether the SQL is *right*. Read it and confirm:

- It is a **new** file under `supabase/migrations/`. Migration 005 is untouched.
- It uses `CREATE OR REPLACE FUNCTION`, not `DROP` then `CREATE`. Dropping would take the
  grants and any dependent objects with it.
- The `RETURNS TABLE` block is **unchanged** — `full_name` is still declared `text`. The
  cast goes in the body, on the select.
- `SECURITY` and `SET search_path` are preserved exactly as migration 013 left them.

**👁️ CHECKPOINT V-A.**

```bash
supabase db reset
```

Then in Supabase Studio at `http://127.0.0.1:54323`, SQL Editor:

```sql
select * from search_users('a', '<a seeded user uuid>', 10);
```

**Before the fix** this errors with `42804`.
**After the fix** it returns rows, or an empty result, with no error.

Then with the backend running and a valid token:

```
GET http://localhost:5001/api/users/search?q=a
```

must return `{ "items": [ ... ], "next_cursor": null }`.

Then, and only then:

```bash
supabase db push
```

and post in the CHANGELOG that it is on production, so Neeraj can run N-A part 2.

## Block V-B — The real font-scale clamp (half a day, Day 2)

Run prompt **CC-V2**.

**Read §0.3 first if you have not.** The existing `DENSE_TEXT_SCALE_CAP = 1.3` in
`ProductCard.tsx` is not doing anything — Android's slider tops out at about 1.30, so a cap
of 1.30 clamps nothing. This block replaces it.

**Why cap at all, and why not disable.** A student who has set larger text has weak
eyesight or a small screen, and turning scaling off entirely (`allowFontScaling={false}`)
makes the app unusable for exactly the people who needed the setting. Capping at 1.15 means
they still get 15% larger text — they keep most of the benefit — while your layouts stay
inside what they can absorb. That is the compromise, and it is what the V-R file already
decided.

**👁️ CHECKPOINT V-B.**

1. Open the app on the POCO at **default** settings. Nothing should look different. If
   something moved, the clamp is being applied where it should not be.
2. Set the POCO to **largest** font size. Text should grow, but noticeably less than before.
3. Retake the five screenshots into `docs/screenshots/post-VB/`. Compare with `pre-VR/`.
   Some of the four V-R layout bugs may already be gone — note which, because V-D then has
   less to do.

## Block V-C — Type scale and density pass (1.5 days, Days 3–4)

**This is the block that answers "make it premium".** Read §0.4, §0.5, §1.4 and §1.5 first.
They are the reasoning behind every number in the prompt, and you will be reviewing the
output against them.

Run prompt **CC-V3**.

Two things happen here. The first is mechanical: 20 hardcoded font sizes collapse into 7
theme tokens, with a hard floor of 11dp. The second is a judgement call, and it is yours:
the product card stats row goes from four items to two.

**👁️ CHECKPOINT V-C.** This one needs your eyes more than any other in the phase.

1. Open the app on the POCO at default and walk every screen. You are not checking for
   bugs — Claude Code and Neeraj do that. You are checking whether it **looks better**. If
   a screen looks worse, say which and why; the scale can be adjusted once, at this point,
   and not after.
2. Specifically look at the product card. Two stats instead of four. Does the price stand
   out? Does the card feel calmer?
3. Confirm nothing anywhere is below 11dp:

```bash
grep -rn "fontSize: \([0-9]\|10\b\)" mobile/app mobile/src --include=*.tsx | grep -v "fontSize: 1[1-9]\|fontSize: [2-9][0-9]"
```

   That should print nothing.

4. Retake the five screenshots into `docs/screenshots/post-VC/`.

**If you decide the two-item stats row loses something you want**, say so now. Putting
views and comments on the seller's own dashboard instead is a small change and a better
home for them, and it is a one-line note into Phase 6.

## Block V-D — The four layout fixes (1 day, Day 5)

Run prompt **CC-V4**, but **read the retaken screenshots first**. V-B and V-C may have
resolved some of the four already. The prompt tells Claude Code to check each one before
changing anything, and to report which were already fixed — do not let it apply a fix to a
bug that no longer exists, because that leaves a hack in the code with no problem attached.

**👁️ CHECKPOINT V-D.** On the Samsung, which Neeraj holds, so coordinate:

1. All four fixes hold at **default** font size.
2. All four still hold at **largest** font size.
3. The **List an item** button does not overlap the pass/like buttons at any point.

## Block V-E — Mobile infinite scroll (1 day, Day 6)

Run prompt **CC-V5**. Read §1.6 and §1.7 first.

Three surfaces, and the third is different from the other two:

| Surface | Hook | Pattern |
|---|---|---|
| Marketplace | `useMarketplace.ts` | Standard. `onEndReached` |
| Product comments | `useProductDetail.ts` | Standard, inside the detail screen |
| Chat history | `useMessages.ts` | **Reverse.** Use `inverted` on the FlatList |

The previous phase left the sockets ready. `useMarketplace.ts` already returns `nextCursor`
and carries a comment saying exactly where this plugs in.

**👁️ CHECKPOINT V-E.** Your local seed data now has more than 20 listings on `iiitk.ac.in`,
so this is testable:

1. Open the marketplace. Scroll to the bottom. More listings load.
2. Keep scrolling to the true end. Loading stops, and no spinner is left spinning forever.
3. Open a chat with more than 30 messages. It opens at the **newest**. Scroll up. Older
   messages load, **and the view does not jump**.

Item 3 is the one that breaks. If the view jumps, `inverted` is missing or is fighting
something.

## Block V-F — Back-navigation and the `focusManager` decision (half a day, Day 6)

Run prompt **CC-V6**.

**The bug**, from the build plan: opening a product from the Dashboard and pressing back
lands on the Marketplace instead of the Dashboard. It returns correctly from the
Marketplace and from public profiles. Only the Dashboard route is wrong.

**The `focusManager` item is a decision, not code.** My recommendation, and the reasoning,
is in §0.6: do not wire it. Write the decision into `docs/CHANGELOG.md` with the reason, so
Phase 6 does not reopen it.

**👁️ CHECKPOINT V-F.** Four back-navigations, on any phone:

| From | Open a product, press back | Expected |
|---|---|---|
| Dashboard | | **Dashboard** ← the bug |
| Marketplace | | Marketplace |
| Public profile | | that profile |
| Search results | | search results |

---

# TRACK 2 — VISHWAJEET, CLAUDE CODE PROMPTS

Start every session with the standard opener from build plan §2.4:

```
Before we start: read CLAUDE.md, docs/CHANGELOG.md, backend/API.md,
and docs/CURRENT_STATE.md. Summarise in 5 bullets what changed most
recently and what I should be careful about.
```

## CC-V1 — The `search_users` migration

```
Phase 5, Block V-A. One migration. I own the database.

THE BUG
GET /api/users/search?q=<anything> returns 500 INTERNAL_ERROR. The
backend log shows PostgreSQL 42804:

  Returned type character varying(255) does not match expected type
  text in column 3

public.search_users() declares column 3 of its RETURNS TABLE as `text`.
The selected column, public.users.full_name, is character varying(255).
PL/pgSQL checks the row structure at execution time, not at creation,
which is why the migration applied cleanly and nobody noticed for a
month.

This is pre-existing, not a Phase 4 regression. The function was last
defined in 20260815061951_usernames.sql line 725. Migration
20260903123107 only pinned its search_path and did not touch the
signature.

THE AUDIT IS ALREADY DONE -- DO NOT REDO IT
All seven declared columns have been checked against the live table
definitions. Only column 3 is wrong:

  1 id              uuid        vs users.id uuid                 OK
  2 username        text        vs users.username text           OK
  3 full_name       text        vs users.full_name varchar(255)  BROKEN
  4 avatar_url      text        vs users.avatar_url text         OK
  5 university_name varchar     vs universities.name varchar(255) OK
                                (same base type -- passes the check)
  6 is_same_campus  boolean     vs computed boolean              OK
  7 rank            real        vs greatest(similarity,..) real  OK

Do not "fix" column 5. Same base type, passes, and changing a working
column for tidiness is how working things break.

WHAT TO DO
1. Run: supabase migration new search_users_full_name_cast
2. In the new file, CREATE OR REPLACE FUNCTION public.search_users
   with the body from migration 005, changing exactly one thing:
   select u.full_name::text instead of u.full_name.
3. Leave the RETURNS TABLE block EXACTLY as it is. full_name stays
   declared as `text`. The cast goes in the body.

   Reason, so you do not "improve" it: declaring
   character varying(255) instead would also work, but it welds the
   function signature to a column width. The day someone widens
   full_name, this breaks again invisibly. Keeping the declared type as
   text keeps the contract stable regardless of the table.
4. Preserve, byte for byte:
   - the language (plpgsql) and the `stable` volatility
   - the existing SECURITY setting -- do NOT change invoker to definer
     or the reverse
   - the `set search_path` pinned by migration 20260903123107
   - the full ORDER BY: exact-match first, then same-campus, then rank.
     Block N-C of Phase 4 and the client both depend on that order.
   - the p_limit parameter and its default

RULES FROM docs/YAHORA_BUILD_PLAN.md §3.1 THAT APPLY
- One migration, one idea.
- NEVER edit a migration that has already been applied. Migration 005
  is not to be touched.
- A migration that passes on an empty local database can fail on
  production. State explicitly whether anything here could behave
  differently against existing rows.

AFTER WRITING IT
Run: supabase db reset
Then give me a SQL snippet to paste into Studio that proves the fix,
using a seeded user uuid.
Do NOT run supabase db push. I run anything that touches production.

HARD CONSTRAINTS
- Create exactly ONE new file under supabase/migrations/.
- Do NOT modify any existing migration file.
- Do NOT touch backend/ , frontend/ or mobile/. The controller is
  already correct -- it has simply never successfully executed.
- Do NOT run supabase db push.
- Do NOT add pagination, a cursor, or any new parameter. Search is
  deliberately exempt from cursor pagination; that was settled in
  Phase 4.
- Update backend/API.md: GET /api/users/search has never worked, and
  Part 1 of that file describes routes as they really are.
- Update docs/CHANGELOG.md under "### Migrations applied".
```

## CC-V2 — The real font-scale clamp

```
Phase 5, Block V-B. Add a global font-scale clamp to the mobile app.
Nothing else.

THE PROBLEM
Android's Settings > Display > Font size multiplies every <Text> by up
to about 1.30. Our layouts break above roughly 1.15: on a Samsung
Galaxy A03s at default font size the product card stats row overlaps
itself and the auth headline is clipped by the settings gear.

FIRST, READ THIS -- THE EXISTING "FIX" IS NOT ONE
mobile/src/components/ProductCard.tsx line 40 defines:

  const DENSE_TEXT_SCALE_CAP = 1.3;

and applies it via maxFontSizeMultiplier in four places. Android's
slider tops out at about 1.30, so a cap of 1.30 clamps essentially
nothing. It reads like a fix in review and does not behave like one.

Part of this task is to reconcile that constant with the real clamp
rather than leaving two competing ideas in the codebase.

WE ARE NOT DISABLING FONT SCALING
A student who needs larger text must still get larger text. We are
capping how far it can go, not switching it off.

WHAT TO DO
1. Create mobile/src/components/AppText.tsx: a thin wrapper around
   React Native's Text that sets maxFontSizeMultiplier={1.15} by
   default, forwards every other prop AND the ref, and lets a caller
   override the multiplier explicitly.
   It must pass through numberOfLines, ellipsizeMode, style, onPress
   and children unchanged. Type it so existing call sites compile with
   no change other than the import.
2. Create mobile/src/components/AppTextInput.tsx the same way.
   TextInput scales too and several of our inputs have fixed heights.
3. Replace the Text and TextInput imports across mobile/src and
   mobile/app so screens use AppText / AppTextInput.
   EXCEPTION: leave the auth screen headline and the empty-state
   messages on plain Text. Those have room to grow and should honour
   the student's setting in full.
4. Remove DENSE_TEXT_SCALE_CAP from ProductCard.tsx and the four
   maxFontSizeMultiplier props that use it. The global clamp now
   covers those call sites at a value that actually binds.
5. Record the decision in a comment in mobile/src/theme/index.ts: the
   cap is 1.15, it is a cap and not a disable, Android's own maximum is
   about 1.30, and a previous 1.3 constant was a no-op.

HARD CONSTRAINTS
- Do NOT set allowFontScaling={false} anywhere. Capping is the
  decision; disabling makes the app unusable for students with weak
  eyesight.
- Do NOT change any fontSize value. That is the next block.
- Do NOT change layout, spacing, or colours in this prompt.
- Do NOT touch backend/ , supabase/ or frontend/ .
- Do NOT add a dependency.

VERIFY AFTER -- report each
1. Number of files changed, and the count of call sites converted.
2. Any file where you left plain Text deliberately, and why.
3. npx tsc --noEmit in mobile/ passes.
4. Confirm DENSE_TEXT_SCALE_CAP no longer exists anywhere.
```

## CC-V3 — Type scale and density pass

```
Phase 5, Block V-C. Typography and content density. This is a design
pass, not a bug fix. Read all of it before changing anything.

THE GOAL
The app should feel less cluttered and more premium, and less text
should be cropped. Those are the same problem. Reference points the
founders named: super.money, Blinkit, Zepto.

WHAT IS ACTUALLY WRONG -- MEASURED, NOT GUESSED
mobile/app and mobile/src contain 20 distinct hardcoded fontSize
values across 223 usages:

  8(3) 9(6) 10(13) 11(33) 12(41) 13(39) 14(31) 15(19) 16(10)
  17(6) 18(2) 19(2) 22(4) 23(3) 24(3) 28(4) 30(2) 34(2) 40(1)

Meanwhile mobile/src/theme/index.ts already defines
sizes: { sm: 13, md: 15, lg: 18, xl: 24, xxl: 30 } which is largely
ignored.

Two consequences:
- 22 usages sit at 8-10dp, below comfortable reading size. Small grey
  text is the strongest "cheap app" signal there is.
- 20 sizes means no hierarchy. When 13, 14 and 15 appear on one screen
  the eye cannot tell what matters. That flatness IS the clutter.

PART 1 -- THE TYPE SCALE
Replace font.sizes in mobile/src/theme/index.ts with seven tokens, and
migrate every hardcoded fontSize onto them:

  micro    11   <- replaces 8, 9, 10
  caption  12   <- replaces 11, 12
  body     13   <- replaces 13, 14
  bodyLg   15   <- replaces 15, 16
  title    18   <- replaces 17, 18, 19
  headline 22   <- replaces 22, 23, 24
  display  28   <- replaces 28, 30, 34, 40

Note the direction: everything from 14 upward comes DOWN by one to
four points, and everything below 11 comes UP. The app gets airier at
the top and readable at the bottom.

THE FLOOR RULE IS ABSOLUTE: nothing below 11dp anywhere, for any
reason. At font scale 0.85 an 11dp label already renders at 9.35dp.

Keep the old token names as aliases pointing at the new values if that
avoids a large mechanical diff, but every NEW reference uses the new
names.

PART 2 -- DENSITY, WHICH MATTERS MORE THAN PART 1
A Blinkit tile shows 5 things. Our ProductCard shows 10: image, title,
price, condition badge, view count, like count, comment count,
timestamp, like button, save button.

Premium apps show FEWER things, not smaller things. Removing content is
the strongest responsive fix available.

In mobile/src/components/ProductCard.tsx, cut the stats row from four
items to two:
  - REMOVE the view count and the comment count from the card.
  - KEEP the condition badge and the timestamp.
  - Keep the like and save buttons; they are actions, not stats.

This ends the "1350 1 0 09h ago" collision permanently, at every font
scale on every device, in a way no flexShrink can.

Then make the PRICE the largest element on the card -- `title` (18),
semibold -- and let the product title sit at `body` (13). One element
should dominate; right now nothing does.

HARD CONSTRAINTS
- Do NOT go below 11dp anywhere.
- Do NOT remove any numberOfLines. Deliberate truncation stays.
- Do NOT change colours or add new ones in this prompt.
- Do NOT change spacing tokens, layout direction, or flex properties.
  Layout is the next block and must stay separately attributable.
- Do NOT delete the view/comment counts from the PRODUCT DETAIL screen
  or the seller dashboard. They are being removed from the card only.
- Do NOT touch backend/ , supabase/ or frontend/ .
- Do NOT add a dependency or a font family.

VERIFY AFTER -- report each
1. The count of hardcoded fontSize values remaining outside the scale.
   Target is zero.
2. Prove nothing is below 11: show the output of
   grep -rn "fontSize: [0-9]\+" mobile/app mobile/src --include=*.tsx
   filtered to values under 11.
3. Every screen where a size changed by more than 2dp, so I know where
   to look first.
4. npx tsc --noEmit passes.
```

## CC-V4 — The four layout fixes

```
Phase 5, Block V-D. Fix four layouts that break on small or dense
screens. The font-scale clamp (V-B) and the type scale (V-C) are
already in.

BEFORE YOU CHANGE ANYTHING
V-B and V-C may have already resolved some of these. For EACH of the
four, first inspect the current code and state plainly whether the
problem still exists. If it does not, say so and change nothing there.
Do not apply a fix to a bug that is already gone -- that leaves a hack
in the codebase with no problem attached to it.

TEST TARGET
The smallest supported viewport is about 360 x 800 dp (Samsung Galaxy
A03s at default display size) with font scale 1.15. Every fix must hold
there.

FIX 1 -- product card stats row
mobile/src/components/ProductCard.tsx, the metaRow and statsRow styles.
metaRow is flexDirection row with justifyContent 'space-between' and
gap 6, and the stats group has no shrink handling, so at larger text
the counts run into the timestamp and render as "1350 1 0 09h ago".
Give the stats group flexShrink: 1 with minWidth: 0, and let the
timestamp shrink or drop rather than overlap.
NOTE: V-C cut this row from four items to two, so this may already be
comfortable. Check first.

FIX 2 -- auth email field
The Send Code button overlays the email input and covers the
you@uni.edu placeholder at larger text.
Make the input and the button a flex row: input flex 1 with
minWidth: 0, button flexShrink: 0. If the row cannot fit at the test
size, stack the button BELOW the input rather than overlapping it.

FIX 3 -- auth headline vs settings gear
"Keep the story going." is clipped by the floating gear button.
Reserve horizontal space for the gear so the headline wraps before
reaching it instead of running underneath. Allow the headline two
lines.
NOTE: V-C brought the display size down from 34 to 28. This one in
particular may already be fixed. Check before touching it.

FIX 4 -- swipe screen vertical overflow
mobile/app/(tabs)/index.tsx, swipe mode.
At 360x800 the "N items left" label is hidden behind the card stack and
the List an item FAB overlaps the pass/like buttons.
Make the swipe area flexible rather than fixed height: the card deck
takes the remaining space after the header, the action row and the
label, using flex rather than a hardcoded height. The FAB must not
overlap the pass/like buttons at any viewport.

HARD CONSTRAINTS
- Do NOT remove any numberOfLines. Deliberate truncation stays; a title
  ending in ".." is the design working, not a bug.
- Do NOT change fontSize values, colours, or theme tokens. Those were
  settled in V-C and must stay separately attributable.
- Do NOT add a dependency.
- Do NOT touch backend/ , supabase/ or frontend/ .
- Do NOT attempt to make screens pixel-identical across devices. The
  goal is that nothing overlaps, nothing is clipped and nothing is
  unreachable. Anything beyond that is out of scope and will be
  rejected in review.

VERIFY AFTER -- report each
For each of the four: whether it was still broken, what changed, which
file, and plainly whether it holds at 360x800 dp with font scale 1.15.
```

## CC-V5 — Mobile infinite scroll

```
Phase 5, Block V-E. Switch three mobile lists from one page to infinite
scroll using TanStack Query's useInfiniteQuery.

THE BACKEND IS READY
Phase 4 added cursor pagination to every list endpoint. They all return
{ items, next_cursor }, default 20 per page, max 50, and next_cursor is
null at the end of the list. That null is the ONLY end-of-list signal.
Do not infer the end from an empty array or a short page.

THE SOCKETS ARE ALREADY THERE
mobile/src/hooks/useMarketplace.ts already unwraps page.items and
returns nextCursor, with a comment saying this is where infinite scroll
plugs in. Read that comment before you start. useProductDetail.ts and
useMessages.ts carry similar notes.

SURFACE 1 -- MARKETPLACE (standard)
mobile/src/hooks/useMarketplace.ts, used by mobile/app/(tabs)/index.tsx
- Switch useQuery to useInfiniteQuery.
- initialPageParam: undefined
- getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined
- Flatten with data.pages.flatMap(p => p.items).
- KEEP the hook returning `products`, not `items`. The screen, the
  filters hook and the optimistic like/save patches in
  useProductActions all read data.products today. The existing comment
  in the file explains why that name was chosen. Do not rename it.
- On the FlatList: onEndReached with onEndReachedThreshold={0.5}, and
  guard it with `if (hasNextPage && !isFetchingNextPage)`. Without that
  guard onEndReached fires repeatedly and sends the same request
  several times.
- Show a small spinner as ListFooterComponent while
  isFetchingNextPage, and nothing when there are no more pages.

SURFACE 2 -- PRODUCT COMMENTS (standard)
mobile/src/hooks/useProductDetail.ts and mobile/app/product/[id].tsx.
Same pattern. The comments list is nested inside the product response,
so read the existing unwrapping carefully before changing it, and keep
the threading (parents and replies) rendering exactly as it does now.

SURFACE 3 -- CHAT HISTORY (REVERSE -- READ THIS TWICE)
mobile/src/hooks/useMessages.ts and mobile/app/chat/[contactId].tsx.

Chat pages the OTHER way. The thread opens scrolled to the NEWEST
message. Scrolling UP loads OLDER messages, which PREPEND to the top.

- Use `inverted` on the FlatList. That flips the list so "the end" is
  visually the top, which makes onEndReached fire when the user scrolls
  up, and -- importantly -- makes React Native maintain scroll position
  when content is added. Without inverted, prepending a page makes the
  view jump backwards and the user loses their place. That is the bug
  this surface always produces.
- With inverted, render the array newest-first. The backend sends each
  page oldest-first (Phase 4 Block N-C queries descending then reverses
  before sending), so you reverse each page for display.
- Do NOT sort messages on the client. If the order looks wrong, the
  backend is wrong and I need to know -- stop and tell me rather than
  patching it in the UI.
- Realtime insert of a NEW message must still appear at the bottom
  (which is index 0 in an inverted list) and must not be undone by a
  page load.

HARD CONSTRAINTS
- Do NOT change any backend file, migration, or API.md. The endpoints
  are correct and finished.
- Do NOT touch frontend/ . Neeraj is doing the web version in parallel
  and we must not collide.
- Do NOT change the response key names the screens read today.
- Do NOT add a dependency. TanStack Query is already installed.
- Do NOT set a limit above 50; the server caps it there anyway.
- Do NOT wire TanStack's focusManager to AppState. That is a separate
  decision in Block V-F and the answer is no.

VERIFY AFTER -- report each
1. For each of the three surfaces: which file, and how the next page is
   triggered.
2. Confirm explicitly that chat uses `inverted` and that you did not
   sort on the client.
3. Where the "no more pages" state is handled for each surface.
4. npx tsc --noEmit passes.
```

## CC-V6 — Back-navigation and the focusManager decision

```
Phase 5, Block V-F. One navigation bug and one written decision.

THE BUG
Opening a product from the Dashboard and pressing back lands on the
Marketplace instead of the Dashboard. It returns correctly from the
Marketplace and from public profiles, so only the Dashboard route is
wrong.

docs/YAHORA_BUILD_PLAN.md line 481 describes this as the known root
<Slot/> tab-reset behaviour, needing precise back-to-origin.

WHAT TO DO
1. Diagnose it first and tell me the cause before fixing it. I want to
   know whether it is the tab layout resetting, a router.replace where
   it should be router.push, or the product route being registered
   outside the tab stack.
2. Fix it so back returns to wherever the product was opened from:
   Dashboard, Marketplace, public profile, or search results.
3. Do not solve it by recording "the last screen" in a module-level
   variable or in context. That breaks as soon as two products are
   opened in sequence, and it will not survive a background/foreground
   cycle. Use the router's own history.

THE DECISION -- NO CODE
TanStack Query's refetchOnWindowFocus is inert on React Native;
focusManager is web-only unless wired to AppState. It was deliberately
left unwired.

The decision is to KEEP it unwired. Write this into docs/CHANGELOG.md
under a "### Decisions" heading, with the reasoning:
  - Wiring focusManager globally re-runs GET /products/:id on every
    foreground.
  - That inflates products.views.
  - The build plan already flags products.views as incremented by two
    uncoordinated paths and untrustworthy, and schedules fixing it in
    Phase 6.
  - Wiring it now would make a Phase 6 problem harder to solve in
    order to fix a problem we do not have. The explicit AppState
    resync already does the real work.

Do NOT write any focusManager code. The deliverable is the CHANGELOG
entry.

HARD CONSTRAINTS
- Files you may touch: mobile/app/_layout.tsx, mobile/app/(tabs)/ route
  files, mobile/app/product/[id].tsx, docs/CHANGELOG.md.
- Do NOT touch backend/ , supabase/ or frontend/ .
- Do NOT change any screen's visual layout. This is navigation only.
- Do NOT add a navigation dependency. Expo Router is already here.

VERIFY AFTER -- report each
1. The actual cause, in one paragraph.
2. Each of the four origins and where back now lands from it.
3. Confirm the CHANGELOG decision entry is written.
```

---

# TRACK 3 — NEERAJ, MANUAL STEPS

Six blocks. Two are web coding, one is a verification that unblocks Vishwajeet, and the
rest is the testing — which in this phase is the part that decides whether the UI work
actually landed.

## Block N-0 — Setup and baseline (1 hour, Day 1)

Your branch is **5 commits behind `main`**.

```bash
cd ~/path/to/yahora
git checkout main && git pull origin main
git checkout neeraj && git merge main && git push origin neeraj
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 👁️ The device reset — this invalidates previous visual testing

On the **OPPO K14** and on the **Samsung Galaxy A03s**, set **both**:

- **Settings → Display → Font size** → default
- **Settings → Display → Display size** → default

Write down what each was set to before you change it. If a bug turns out to appear only at
a non-default setting, that number is the evidence.

**Why this matters.** Vishwajeet's POCO has been on a *reduced* font size, which is the
whole reason the same screens look fine to him and broken to you. Until all three phones
are at a known setting, nobody can tell whether a difference is a bug or a settings
difference, and every discussion goes in circles.

### 👁️ The baseline screenshots

Five screens, on **each** of your two phones, at default settings:

1. Auth / login
2. Marketplace — grid mode
3. Marketplace — swipe mode
4. Product detail
5. Chat thread, with at least ten messages in it

Save as `docs/screenshots/pre-VR/oppo-01-auth.png` … and
`docs/screenshots/pre-VR/samsung-01-auth.png` … Vishwajeet does the POCO's five. Fifteen in
total.

**👁️ CHECKPOINT N-0.** Both phones at default on both settings, the previous values written
down, and ten screenshots committed.

## Block N-A — Verify the search bug, before and after (half a day, Days 1–2)

This block is why Vishwajeet's V-A can be trusted. It is in two halves with his migration
in between.

### Part 1 — before the fix (Day 1, do this first, it unblocks him)

**The claim to test:** `GET /api/users/search` has been returning 500 since 15 August and
user search has never worked on production. That is a strong claim and it is currently
unverified on production — only local was tested.

👁️ With the **production** site open and logged in, use the user search box. Then check the
production backend logs on Render.

Record in `docs/CHANGELOG.md`:

| Question | Answer |
|---|---|
| Does production search return results? | |
| What does the browser show? | |
| What is the exact error in the Render log? | |
| Does the log show `42804` and `column 3`? | |

**If production is broken too**, say so plainly — that means campus-wide user search is
down on the live site right now, and the fix becomes the most urgent thing in the phase.

**If production somehow works**, that is a much more interesting result and you must stop
and say so before Vishwajeet pushes anything. It would mean production's schema differs
from the migrations, which is a bigger problem than the bug.

Post the result in the CHANGELOG. Vishwajeet is waiting on it.

### Part 2 — after the fix (Day 2)

Once Vishwajeet posts that the migration is on production:

👁️ Repeat the same search on production. It must return results.

Then check the web side actually reads the response. Phase 4 renamed the response key from
`{ users: [...] }` to `{ items: [...], next_cursor: null }`. That rename was written but
**has never successfully executed**, because the endpoint always 500'd before reaching it.
So the frontend's read of the new key is untested.

```bash
grep -rn "\.users\b" frontend/src/ | grep -i search
```

If anything still reads `.users` for search, fix it to `.items`. If it already reads
`.items`, confirm that in the CHANGELOG — the Phase 4 sign-off line about this is still
open and this is what closes it.

**👁️ CHECKPOINT N-A.** Search returns results on production, the web renders them, and both
halves are recorded in the CHANGELOG.

## Block N-B — Web infinite scroll: marketplace and comments (1.5 days, Days 2–3)

Run prompt **CC-N1**. Read §1.6 first.

**What is already true.** `Marketplace.jsx:579` already reads `data.items` and there is a
comment at line 574 saying `data.next_cursor` is deliberately ignored *for now*. That
"for now" is this block. `ProductDetail.jsx:401` carries the same note about
`product.comments.next_cursor`.

**The web has no `onEndReached`.** That is a React Native thing. On the browser you use an
`IntersectionObserver`: you put an empty `<div>` at the bottom of the list, and the browser
tells you when that div scrolls into view. When it does, you fetch the next page.

**👁️ CHECKPOINT N-B.** In the browser at `http://localhost:5173`:

1. Open the marketplace on a campus with more than 20 listings — your seed data now covers
   `iiitk.ac.in`. Scroll to the bottom. More listings appear.
2. Keep scrolling to the true end. Loading stops cleanly. No spinner left spinning.
3. **No duplicates and no gaps.** If you see the same listing twice, stop and report it —
   that is the exact failure cursors exist to prevent, and it means the cursor is not being
   fed back correctly.
4. Open a product with more than 20 comments. Same three checks.
5. Apply a marketplace filter, then scroll. The filter must still be applied on page two.
   This is the one people forget: if the cursor request drops the filter, page two shows
   unfiltered results.

## Block N-C — Web infinite scroll: chat (1 day, Days 4–5)

Run prompt **CC-N2**. **Read §1.7 before you start.** Chat is the hard one and it goes
wrong in a specific, predictable way.

The short version: a chat opens at the **bottom** and you scroll **up** for history. New
pages prepend to the top, which pushes everything down, which makes the view jump backwards
unless you compensate for it.

**👁️ CHECKPOINT N-C.** Open a chat with more than 30 messages:

1. It opens showing the **newest** messages, at the bottom.
2. Scroll up. Older messages load.
3. **The view does not jump.** This is the whole test. You should still be looking at the
   same message you were looking at before the page loaded. If the screen leaps, the scroll
   compensation from §1.7 is missing or wrong.
4. Scroll up to the very first message. Loading stops.
5. With the chat open, have someone send you a new message. It appears at the bottom, and
   loading history does not make it disappear.

## Block N-D — The device matrix (2 days, Days 5–6)

**This is the block that decides whether the UI work passed.** It is yours alone.

### The matrix

On each of the three phones, at **default** font size and display size, then again at
**largest** font size:

| Screen | POCO X2 | OPPO K14 | Samsung A03s |
|---|---|---|---|
| Auth | | | |
| Marketplace grid | | | |
| Marketplace swipe | | | |
| Product detail | | | |
| Chat thread | | | |

Ten runs per phone. **Thirty in total.**

### 👁️ Look for exactly three failures, and nothing else

1. **Text clipped by another element** — a heading running under a button, a label cut off
   by an edge.
2. **Two things overlapping** — one control drawn on top of another.
3. **Something unreachable** — a button off-screen, behind the navigation bar, or covered
   so it cannot be tapped.

### These are passes, not failures — do not report them

- Titles truncating at different points on different phones. `numberOfLines={1}` with an
  ellipsis is deliberate.
- The **List an item** button floating over cards while scrolling. Every app with a
  floating button does this, and `listContent` already has bottom padding so it clears at
  the end of the list.
- Different numbers of cards visible per screen.
- Text wrapping onto a different number of lines.

**That list is short on purpose.** Without it, "check the UI on three phones" produces a
pile of observations nobody can act on, and the block turns back into chasing pixel parity
— which §0 of this runbook explicitly rules out as the goal.

### The one judgement call that IS yours

Vishwajeet's Block V-C cut the product card stats row from four items to two, and brought
fifteen font sizes down. **Tell him whether it looks better.** Not whether it is broken —
whether it looks *better*. You are the second pair of eyes and the only one who has been
looking at the Samsung. If a screen now feels empty rather than calm, that is worth
knowing, and this is the moment to say it.

**👁️ CHECKPOINT N-D.** All thirty runs done. Every failure logged against one of the three
categories, with a screenshot. Then retake the five screens on both your phones into
`docs/screenshots/post-VR/`.

## Block N-E — Confirm realtime on mobile (half a day, Day 6)

From the build plan: realtime message delivery depends on `messages` being in the
`supabase_realtime` publication and on RLS letting the client see its own rows. Mobile uses
the same anon client and the same channel name as web, so if web realtime works this should
too — **but nobody has ever verified it on a phone.**

👁️ Two devices, two accounts, same campus:

| # | Check | Expected |
|---|---|---|
| 1 | A sends a message. B has the chat open | It appears on B **without B refreshing** |
| 2 | A sends. B is on the inbox list, not in the chat | The inbox row updates |
| 3 | A sends. B has the app in the background, then opens it | The message is there |
| 4 | Both send at the same time | Both arrive, in a sensible order, no duplicates |
| 5 | Turn B's Wi-Fi off, A sends, turn it back on | The message arrives once B reconnects |

**If check 1 fails**, realtime is not working on mobile and the app is polling or relying on
the refetch. Report it with what you saw. Do not try to fix it — it is mobile code, which
is Vishwajeet's, and it is a Phase 6 item if it turns out to be broken.

**👁️ CHECKPOINT N-E.** All five recorded in the CHANGELOG with a pass or fail each.

---

# TRACK 4 — NEERAJ, CLAUDE CODE PROMPTS

Two prompts. Block N-A is verification, not coding, and Blocks N-D and N-E are human
testing, so there is nothing to paste for those.

Start every session with the standard opener.

## CC-N1 — Web infinite scroll: marketplace and comments

```
Phase 5, Block N-B. Add infinite scroll to two web lists.

OWNERSHIP NOTE -- READ THIS
The Phase 4 ownership loan has EXPIRED. In Phase 4 I was permitted to
edit the read handlers in backend/src/modules/products/ and
backend/src/modules/messages/. That permission does not carry into
Phase 5. This block is frontend/ only. If something appears to need a
backend change, STOP and tell me; I will raise it with Vishwajeet.

THE BACKEND IS READY AND FINISHED
Every list endpoint returns { items, next_cursor }, 20 per page by
default, 50 max. next_cursor is null at the end of the list, and that
null is the ONLY end-of-list signal. Do not infer the end from an empty
array or from a page shorter than the limit.

WHAT IS ALREADY THERE
frontend/src/pages/marketplace/Marketplace.jsx line 579 already reads
data.items, with a comment at line 574 saying data.next_cursor is
deliberately ignored "for now". This block is that "for now".
frontend/src/pages/product/ProductDetail.jsx line 401 carries the same
note about product.comments.next_cursor.
Read both comments before you start.

SURFACE 1 -- MARKETPLACE GRID
frontend/src/pages/marketplace/Marketplace.jsx
- Hold pages in state and append, rather than replacing the list.
- Track the current cursor and hasMore (hasMore = next_cursor !== null).
- Trigger the next page with an IntersectionObserver on an empty
  sentinel div rendered at the bottom of the list. The browser has no
  onEndReached.
- Guard against double-firing: if a fetch is already in flight, ignore
  the observer callback. The observer fires repeatedly while the
  sentinel is visible and without a guard you will send the same
  request several times.
- Disconnect the observer on unmount.
- FILTERS: when a filter or the campus changes, RESET the pages, the
  cursor and hasMore, then fetch page one. And carry the active filter
  query parameters into every cursor request. If page two drops the
  filter, page two shows unfiltered results -- this is the most common
  bug in this pattern.
- Show a small spinner while loading the next page, and nothing at all
  once hasMore is false. Do NOT render an "end of list" message.

SURFACE 2 -- PRODUCT COMMENTS
frontend/src/pages/product/ProductDetail.jsx
- Same pattern, scoped to the comments list.
- The comments arrive nested inside the product response. Read the
  existing unwrapping carefully; keep the threading (parent comments
  and their replies) rendering exactly as it does now.
- A newly posted comment must still appear immediately without
  discarding the pages already loaded.

HARD CONSTRAINTS
- Files you may touch: frontend/src/pages/marketplace/Marketplace.jsx,
  frontend/src/pages/product/ProductDetail.jsx, and any small helper
  you create under frontend/src/.
- Do NOT touch backend/ , supabase/ or mobile/ . Vishwajeet is doing
  the mobile version in parallel and we must not collide.
- Do NOT change any API request path or response key.
- Do NOT add a dependency. Use IntersectionObserver, which is built
  into the browser.
- Do NOT request a limit above 50; the server caps it there anyway.
- Do NOT use page numbers or offsets. Cursors only.

VERIFY AFTER -- report each
1. For each surface: how the next page is triggered and how
   end-of-list is detected.
2. Exactly what resets when a filter changes, and confirm the filter
   is carried into the cursor request.
3. What prevents a double fetch while one is in flight.
```

## CC-N2 — Web infinite scroll: chat (reverse)

```
Phase 5, Block N-C. Infinite scroll on the chat thread. This one pages
BACKWARDS and it is the hardest surface in the phase. Read all of it
before writing anything.

FRONTEND ONLY. The Phase 4 ownership loan has expired.

HOW CHAT DIFFERS FROM EVERY OTHER LIST
- A marketplace feed: newest at the top, scroll DOWN, pages APPEND to
  the bottom.
- A chat thread: oldest at the top, newest at the bottom. It opens
  SCROLLED TO THE BOTTOM. You scroll UP for older messages, and pages
  PREPEND to the top.

Three consequences, and the second is the one that produces the bug
report.

1. THE TRIGGER IS AT THE TOP
   Put the IntersectionObserver sentinel at the TOP of the scroll
   container, not the bottom.

2. SCROLL POSITION MUST BE COMPENSATED -- THIS IS THE WHOLE BLOCK
   The container has 2000px of content and the user is at scrollTop 40,
   near the top. Twenty older messages prepend, adding 1500px ABOVE
   them. The browser keeps scrollTop at 40, which is now 1500px further
   back in the conversation. The view leaps backwards and the user
   loses their place.

   Measure and compensate:

     const before = container.scrollHeight;
     // ... the page prepends and renders ...
     const after = container.scrollHeight;
     container.scrollTop += (after - before);

   Do this in a layout effect, before the browser paints, so the user
   never sees the jump. useLayoutEffect, not useEffect.

3. DO NOT SORT ON THE CLIENT
   The backend already sends each page oldest-first: Phase 4 Block N-C
   queries descending and reverses before sending. Prepend each page as
   a whole block. If the order ever looks wrong, the backend is wrong
   and I need to know -- stop and tell me rather than patching it in
   the UI.

ALSO REQUIRED
- On first open, scroll to the bottom.
- A newly received realtime message must still appear at the bottom and
  must not be undone by a history page loading.
- If the user has scrolled up and a new message arrives, do NOT yank
  them to the bottom. That is infuriating. Leave them where they are.
- Stop paging when next_cursor is null. No "beginning of conversation"
  banner.
- Guard against double-firing while a fetch is in flight, and
  disconnect the observer on unmount.

FILES
frontend/src/pages/messages/Messages.jsx is the chat surface.
frontend/src/pages/dashboard/Dashboard.jsx line 630 notes the inbox
also became { items, next_cursor }. Paginate the inbox list too if it
is a plain downward list -- it is, so it follows the standard bottom-
sentinel pattern, not the reverse one.

HARD CONSTRAINTS
- Files you may touch: frontend/src/pages/messages/Messages.jsx,
  frontend/src/pages/dashboard/Dashboard.jsx, and helpers under
  frontend/src/.
- Do NOT touch backend/ , supabase/ or mobile/ .
- Do NOT change any API request path or response key.
- Do NOT add a dependency.
- Do NOT sort or re-order messages client-side.
- Do NOT change the realtime subscription logic. It works; this block
  must not disturb it.

VERIFY AFTER -- report each
1. Where the sentinel is and why it is at the top.
2. The exact scroll-compensation code you used, and confirm it runs in
   useLayoutEffect rather than useEffect.
3. What happens when a realtime message arrives while the user is
   scrolled up.
4. Confirm you did not sort messages on the client.
```

---

# SIGN-OFF

Go through this together at the end of Day 6. One reads, the other confirms. Anything that
cannot be confirmed goes into Phase 6 with a name against it rather than being assumed.

## The search bug

- [ ] 👁️ `GET /api/users/search?q=a` returns results **on production**.
- [ ] 👁️ User search renders results on the live website.
- [ ] The migration is a new file. Migration 005 was not edited.
- [ ] `SECURITY` and the pinned `search_path` are unchanged.
- [ ] **The Phase 4 sign-off line that carried over — "User search returns
      `{ items, next_cursor: null }`, and the web reads the new key" — is now closed.**

## Responsive and typography

- [ ] All three phones are at default font size and display size, and the previous values
      are written down.
- [ ] 👁️ Thirty-run matrix complete, zero failures in the three categories.
- [ ] 👁️ All four V-R layout fixes hold on the Samsung at default **and** at largest font
      size — or are recorded as already fixed by V-B/V-C.
- [ ] No hardcoded `fontSize` outside the seven-token scale.
- [ ] Nothing below 11dp anywhere.
- [ ] `DENSE_TEXT_SCALE_CAP` no longer exists; the real clamp is 1.15.
- [ ] `allowFontScaling={false}` appears nowhere.
- [ ] 👁️ Both of you agree the app looks **better**, not merely unbroken.

## Infinite scroll

- [ ] 👁️ Marketplace pages on web and on mobile.
- [ ] 👁️ Comments page on web and on mobile.
- [ ] 👁️ Chat pages on web and on mobile, and **the view does not jump** on either.
- [ ] 👁️ No duplicates and no gaps on any list.
- [ ] 👁️ A marketplace filter is still applied on page two.
- [ ] Paging stops when `next_cursor` is null. No infinite spinner.

## Navigation and realtime

- [ ] 👁️ Back from a product lands on the Dashboard when opened from the Dashboard, and on
      the correct origin from Marketplace, profile and search.
- [ ] The `focusManager` decision is written into the CHANGELOG with its reasoning.
- [ ] 👁️ All five realtime checks recorded with a pass or fail.

## Documentation and merge

- [ ] `backend/API.md` reflects that search now works.
- [ ] `docs/CHANGELOG.md` has a handoff entry from **each** of you.
- [ ] `docs/CURRENT_STATE.md` updated and dated.
- [ ] `docs/screenshots/pre-VR/` and `post-VR/` both hold fifteen images.
- [ ] `infiniper` and `neeraj` are both merged into `main`, and `main` is pushed.
- [ ] Both of you have pulled `main` and your branches are level with it.

## The standing rule from here on

- [ ] **Written into `docs/CHANGELOG.md`:** from Phase 6 onward, any feature that exists on
      both surfaces is built on both surfaces **in the same phase** — Neeraj on web,
      Vishwajeet on mobile — and neither is signed off until both are done.

The first real test of that rule is Phase 6's "Mark as Sold" rework: a schema change plus
UI on web and mobile. That is exactly the kind of work that drifts apart if one side ships
first, and then the second side inherits decisions it was never asked about.

---

# APPENDIX — QUICK REFERENCE

**Local URLs**

| Service | URL |
|---|---|
| Supabase Studio | `http://127.0.0.1:54323` |
| Mailpit (catches every outgoing email) | `http://127.0.0.1:54324` |
| Supabase API | `http://127.0.0.1:54321` |
| Backend | `http://localhost:5001` |
| Website | `http://localhost:5173` |

**Commands**

```bash
supabase db reset                      # wipe, replay all 16 migrations, run seed.sql
supabase migration new <name>          # new migration file
supabase db push                       # apply to production — Vishwajeet only
node backend/scripts/seedLocal.js      # test data in the real universities
node backend/scripts/seedDemo.js       # demo tenant data

cd mobile && npx expo start            # Neeraj scans with Expo Go 56.0.0
ipconfig getifaddr en0                 # the LAN IP for EXPO_PUBLIC_API_URL
npx tsc --noEmit                       # run in mobile/ after every mobile block
```

**Checks used in this phase**

```bash
# nothing below 11dp
grep -rn "fontSize: \([0-9]\|10\)\b" mobile/app mobile/src --include=*.tsx

# how many distinct font sizes remain
grep -rhon "fontSize: [0-9]*" mobile/app mobile/src --include=*.tsx \
  | sed 's/.*fontSize: //' | sort -un | wc -l

# the dead cap should be gone
grep -rn "DENSE_TEXT_SCALE_CAP\|allowFontScaling" mobile/
```

**Things that have already cost this project a day**

- Port 5000 on macOS is the AirPlay Receiver. It returns a bodiless 403. Use 5001.
- Expo Go 56.0.1 is broken for SDK 56 on Android. Use 56.0.0.
- `REVOKE ... FROM anon` does nothing without `FROM PUBLIC` as well.
- A migration that passes on an empty local database can fail on production.
- `localhost` on Neeraj's phone means *the phone*, not the Mac.
- A `maxFontSizeMultiplier` set to Android's own maximum clamps nothing at all.

**Deliberately not being fixed in this phase**

Written down so it does not get relitigated mid-block:

- **Pixel-identical rendering across devices.** Not achievable, and not what other apps do.
- **Deliberate truncation.** `numberOfLines={1}` with an ellipsis stays.
- **Support below 360 dp width.** The Samsung A03s is the floor.
- **Tablet and landscape layouts.** No test device, no evidence of use, not on the roadmap.
- **iOS.** `fontScale` behaves differently there (Dynamic Type), and there is no iOS build
  or test device yet.
- **The website's own font-scale and zoom behaviour.** The browser has the same class of
  problem, but no web screenshots have been gathered and no web bug has been reported.
  Gather evidence first; it is a separate block if it turns out to matter.
- **`products.views` double-counting.** Already scheduled for Phase 6.

---

*End of Phase 5 runbook. Next: Phase 6 — Mark as Sold rework, delete message, the
`products.views` fix, and porting the web messages UX to mobile. The first phase under the
build-both-surfaces-together rule.*
