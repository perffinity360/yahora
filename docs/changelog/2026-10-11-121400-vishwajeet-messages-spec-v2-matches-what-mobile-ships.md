---
date: 2026-10-11T12:14:00+05:30
author: vishwajeet
phase: "6A"
block: "WRAP-UP"
for: neeraj
title: "MESSAGES_SPEC v2: matches what mobile ships"
---

# MESSAGES_SPEC v2: matches what mobile ships

`docs/design/MESSAGES_SPEC.md` is now **v2 · 11 October 2026**. It describes what the
mobile app actually ships at the end of Phase 6A. **It is the input for N-D (web wallpaper)
and N-E (web messages redesign).** Implement v2, not v1, and invent nothing.

## ⚠️ Vishwajeet edited `docs/design/`

`MESSAGES_SPEC.md` is your file. The owner asked for this update in my session, before you
build N-E from it. I only edited that one file; nothing else in `docs/design/` changed. The
mockup and the PNGs were **not** regenerated. A note at the top of the spec says they are v1
drawings and that the spec wins. Please review the diff.

Docs only: no code changed in `mobile/`, `frontend/`, `backend/` or `supabase/`, and no
design value was changed. v2 records what ships.

## What changed

The full diff is in the spec's new **§0.1 "What changed from v1"** table. The main points:

- **Read tick is blue `#53BDEB`** on both platforms (§2 Ticks, §3, §7). The contrast on the
  pink end is 2.53, against the 3.0 needed. The owner accepted that knowingly.
- **The wallpaper is drawn at opacity 0.5** (`CHAT_WALLPAPER_OPACITY`). The strokes read as
  about 18–20% purple. The master files are unchanged; each platform applies the opacity
  itself.
- **New §2 sections:** Emoji in messages, Jump-to-latest button, Welcome stickers, Empty
  chat, Beginning-of-conversation note, Unread behaviour.
- **Values v1 didn't give are now written down:**
  - the paddings, gaps and alignment taken from the mockup;
  - the mobile values that were "kept as they were" (online dots, the avatar beside the last
    received bubble, a meta row on every bubble, link colours, the failed-message pill,
    composer details, fallback texts);
  - inbox `0m` under one minute.
- **New §8 "Deferred on both platforms":** the price in the snippet and the `You: ` prefix.
  These are no longer live requirements in §1/§2, because they need `product_price` and
  `last_sender_id`, which the inbox response doesn't carry.
- **New §9 "Not specified yet":** the typing bubble, error states, and the emoji button and
  tray. Each platform keeps its current look.
- **§5 now allows five differences.** The new one is the gradient direction: corner to
  corner on mobile, a true 135° in CSS.
- **§3 lists every messages token with its value.** The `inboxTop/Mid/Bottom` removal note
  is dropped, because those tokens are already gone.

## Where the changelog and the code disagreed (the code won)

- **Jumbo emoji line height.** The 6A entries say "size × 1.25". Both platforms actually use
  `round(size × 1.25)`, which gives **43 / 38 / 33** for 34 / 30 / 26 (not 42.5 / 37.5 /
  32.5). The spec gives the rounded values.
- **Jump-button shadow on Android.** The entry gives `0 2px 6px rgba(128,0,128,0.16)`. Mobile
  sets that, plus `elevation: 3`. Android ignores the coloured shadow and draws elevation as
  system grey. The spec records both. This is arguably a sixth platform difference that §5
  doesn't list. The owner should decide whether to accept it.
- **Jump-button position.** The entry says "12 above the composer". In the code it is 12
  above the bottom of the thread area, which is the top of the emoji tray when the tray is
  open. The spec says "12 above the bottom of the thread area".
- **Superseded entries match the code once you follow them to the latest one:**
  - `2026-10-04-184315` (48/40/32 emoji, 320 px threshold, "Bagsy") was replaced by
    `192039`.
  - The amber tick in `172010` was replaced by the read-tick entry.
  - The 👋 in the wallpaper-fixes entry was replaced by the stickers.
- **Stale comments in mobile code, recorded here only (I didn't touch the code):**
  - `[contactId].tsx:1274` still says "✓✓ in amber when read".
  - `emoji.ts`'s header points to the superseded `184315` entry.

## Not specified (marked in the spec)

- Web hover for the product snippet.
- Web hover for the empty-chat suggestion chips.
- Everything in §9: typing bubble, error states, emoji button and tray.

## N-E checklist: what the web does today that contradicts v2

Read from `frontend/src/pages/messages/` only; I didn't edit anything there. ✅ means it
already matches.

**Inbox**

1. **Canvas:** still the old `#fdf8ff → #f8f0ff → #fff4f9` ramp, with `::before/::after`
   glows. The spec wants the app canvas and no glows.
2. **Header:**
   - Web: padding 18/16/14, a translucent blurred bar with a bottom border, and a count pill.
   - Spec: padding 8/16/12, no bar, and an "N unread conversations" subtitle (hidden at 0).
3. **Search:**
   - Web: radius 12, 1.5px border at 0.12, padding 8/12, placeholder
     `Search conversations…` in `#b8a8c8`.
   - Spec: height 38, radius 19, white 0.78, 1px border at 0.08, inner padding 14,
     `Search conversations` in mutedText.
4. **Row:**
   - Web: padding 13/16, gap 11, a 46 avatar with a 2px border, and a full-width bottom
     border at 0.06. The active row has a gradient and a 3px pink left border.
   - Spec: padding 10/16, gap 12, a 48 avatar with no border, and a divider from left 76
     to 16 from the right. Selected is `rgba(128,0,128,0.08)`.
5. **Online indicator:**
   - Web: a dot next to the name, `#34d399`, pulsing.
   - Spec: a 13 dot on the avatar, `#4ADE80`, with a 2 ring in `#FCF8FC`.
6. **Unread weights:**
   - Web: only the preview changes (`#5a3878`, 600). The name is 700 always and the time is
     `#b0a0c0` always.
   - Spec: name 800, time 700 purple, preview 500 `#1A1A1A`. Read rows: 600 / 500 mutedText /
     400 mutedText.
7. **Time:** web always shows a clock time via `toLocaleTimeString`. The spec's table is
   `0m` · `2m` · `4:41 PM` · `Yesterday` · `Mon` · `12 Sep` · `12 Sep 2025`, with fixed
   English names.
8. **Product chip:**
   - Web: above the preview, with a thumbnail, a border and radius 5.
   - Spec: text only, 5 below the preview, radius 8, no border, background 0.09.
9. **Badge:**
   - Web: 18 min, weight 800, no `99+` cap.
   - Spec: 20 min, weight 700, `99+`.
10. **Fallback name:** web `Unknown`; spec `Yahora student`.
11. **Loading:** web shows a full-page spinner; the spec wants skeleton rows.

**Conversation**

12. **Header:**
    - Web: padding 12/20, a 42 avatar with a border, the name in Bree Serif 0.95rem
      `#1a0a2e`, and a green "Online" label.
    - Spec: padding 8/12, gap 10, a 36 avatar, the name in Inter 600 16 `#0B0B0B`, and a
      status line `<University> · online` in mutedText.
13. **Snippet:**
    - Web: inside the header's text column, `#f8f4ff` with a border, a 22 thumbnail, and a
      `→` character.
    - Spec: its own white strip below the header, a pinkLight pill, a 30 thumbnail, and a
      chevron 13.
14. **Ground (N-D):** the glows and dot grain are still there. There is no wallpaper:
    `frontend/public/patterns/` doesn't exist. Draw the tile at **opacity 0.5**.
15. **Thread padding:** web 16/20, spec 10/12.
16. **Date separator:**
    - Web: hairlines either side, white 0.7 with a border, `rgba(90,48,128,0.55)`, labels
      like `Mon, Sep 12`.
    - Spec: a chip with no lines, white 0.92, mutedText, labels `Mon` / `12 Sep` /
      `12 Sep 2025`.
17. **Unread divider:**
    - Web: a pink uppercase pill with fading lines.
    - Spec: a full-bleed white 0.88 band, Inter 700 11 purple, not uppercase.
18. **Bubble geometry:**

    | | Web today | Spec |
    |---|---|---|
    | Max width | 68% (80% / 88% on small screens), no cap | 78%, capped at 520 |
    | Padding | 9/13/7 | 8/12/6 |
    | Tail radius | 6 | 5 |
    | Text | 0.88rem / 1.45 | 14 / 20 |
    | Gap inside a run | 4 | 2 |
    | Gap between runs | ~13 | 8 |
    | Run rule | sender only | same sender, same day, within 5 min |

19. **Sent bubble:**
    - Web: ends at `#EB487F`, with no solid fallback and no `SENT_BUBBLE_STYLE` switch. The
      second shadow layer is 0.16.
    - Spec: ends at `#C02B7F`, and the second shadow layer is 0.14.
20. **Received bubble:**
    - Web: text `#2a082a`, border 0.07, avatar 28 with gap 8.
    - Spec: text `#1A1A1A`, border 0.08, avatar 26 with gap 6.
21. **Meta row:**
    - Web: time 0.67rem; white 0.82 on sent bubbles, `rgba(42,8,42,0.62)` on received ones.
      The format comes from the locale (`04:41 PM`, or 24-hour).
    - Spec: Inter 500 11; white 0.90 / mutedText; `4:41 PM`.
22. **Ticks:**
    - Web: sent at white 0.5 and delivered at 0.75, all 13 px. There are no pending or failed
      states. Delivered also shows whenever the contact is online, even when the message
      isn't delivered.
    - Spec: white 0.90, sizes 11/14/15/15/12, with pending and failed states.
    - ✅ Read `#53bdeb` already matches, but it's hard-coded; spec §3 names it
      `--chat-read-tick`.
23. **Links:** web renders message text as plain text. The spec wants `#6FE1FF` on sent
    bubbles and `#0B93D8` on received ones, underlined and tappable.
24. **Failed message:** nothing on web. The spec wants opacity 0.72 plus the "Failed — tap to
    retry" pill.
25. **Empty chat:**
    - Web: no card; the text is "Say hello to <name>!"; the chips sit on one wrapping row on
      white 0.8.
    - Spec: a white 0.9 card at radius 20 holding the sticker, the title
      `Start the conversation about <product>.` and the hint. Below it, three stacked chips
      in pinkLight with a `#E5C8E5` border, Inter 600 12 `#4F014F`.
    - ✅ The sticker already matches.
26. **Beginning note:**
    - Web: a banner with a Users icon and different text ("…with <name> about <product>. Be
      respectful…🎓"), white 0.72, radius 14. It also shows above an empty chat.
    - Spec: a white 0.9 pill, radius 12, Inter 400 12/17 mutedText, the text
      `This is the beginning of your conversation about <product>.`, and only in a thread
      that has messages.
27. **Composer:**

    | | Web today | Spec |
    |---|---|---|
    | Padding | 12/16 | 8/10/12 |
    | Input | single-line `<input>` | grows to 5 lines |
    | Input style | `#f8f4ff`, 1.5px border, radius 99 | `#F3F0EF`, no border, radius 20 |
    | Placeholder | `Type a message…` `#9878b8` | `Message` `#BBB6C8` |
    | Inactive send | pale outlined button | the gradient at opacity 0.4 |

28. **Jump button:** ✅ matches, except that hover and press use `var(--pink-light)`. On the
    web that variable is **`#f4e0e4`**, not pinkLight `#FFF4F7`. The same trap applies
    anywhere else the spec says pinkLight.
29. ✅ **Already matching:**
    - emoji sizes, the regex and the jumbo rounding;
    - welcome-sticker pick and the reduced-motion still;
    - unread constants (0.35, 0.5, 300 ms, 80);
    - jump threshold, size, badge and timings.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None. §8 of the spec records the two fields (`product_price`, `last_sender_id`) that the
price and `You:` would need later.

## Test data

None. This is a docs change.

## What NOT to do yet

- Don't build the snippet price or the `You: ` prefix on web (spec §8). Mobile can't show
  them either.
- Don't regenerate `messages-mockup.html` or the PNGs to "fix" them. The spec wins where they
  differ.
- Don't apply the 0.5 wallpaper opacity to the SVG file. Apply it to the layer that draws it
  (spec §2, §4).
- If you disagree with any v2 value, say so in an entry. Don't change one platform alone
  (spec §0).
