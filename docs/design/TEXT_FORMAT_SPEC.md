# Text formatting — design spec

**Version 2 · 13 November 2026 · for chat messages and community posts, on the website and the app**

People copy text between WhatsApp, Telegram and Yahora all day. WhatsApp writes its formatting as
plain-text symbols (`*bold*`), so a copied message used to arrive here with its asterisks showing.
Yahora now reads those symbols the way WhatsApp does, on both platforms, everywhere a message or a
post is shown in full.

`MESSAGES_SPEC.md` (§2 "Formatting") and `COMMUNITY_SPEC.md` (§3 "Text") point here. Change the
rules here first, then both platforms.

**What changed from version 1 (7 Nov):** double symbols (`**bold**`, `__italic__`, `~~strike~~`, §2);
line markers on the website's drawn lines (§3); pasting reads only `<pre>` as a code block, reads
Yahora's own lines back, and takes image files in the post composer (§4); formatting while typing,
shortcuts and a selection bar (new §5); Copy text and Copy link (new §6). The old "Not built" list is
now §7, "Plain on purpose".

---

## 1. Stored as typed

**Nothing changes in the database or the API.** A message or post is stored exactly as typed,
symbols and all, as WhatsApp stores it. Only the screen draws it formatted. So:

- **Copy** (the message menu, and a post's Copy text, §6) copies the symbols, and pasting into
  WhatsApp formats it there too.
- The **character limits** count the symbols (2,000 for a message, 1,000 for a post), as WhatsApp does.
- An older client simply shows the symbols.
- Moderation reads the text with its symbols, which doesn't change what it finds.

## 2. The rules (WhatsApp's)

| Type | Shows as | Where |
|---|---|---|
| `*bold*` or `**bold**` | **bold** | within one line |
| `_italic_` or `__italic__` | *italic* | within one line |
| `~strikethrough~` or `~~strikethrough~~` | ~~strikethrough~~ | within one line |
| `` `inline code` `` | `code` on a tint | within one line |
| ` ```monospace``` ` | monospace | may run over several lines |
| `- item` or `* item` | • item | at the start of a line |
| `1. item` | 1. item, the number as typed | at the start of a line |
| `> quote` | a quote with a bar | at the start of a line |

- **A symbol formats only at the edge of a word.** The opening one comes after a space, punctuation or
  the start of the line, and is followed by something that isn't a space. The closing one follows
  something that isn't a space, and comes before a space, punctuation or the end. So `snake_case_name`,
  `2*3*4`, `* not bold*` and a lone `*` stay as typed. Letters include their combining marks, so
  Hindi words behave like English ones.
- **Double symbols are read too:** `**bold**`, `__italic__`, `~~strike~~`. A pair counts as one
  symbol and follows the same word-edge rule, and it closes only with the same pair. Single symbols
  are unchanged. (Markdown and ChatGPT write doubles, so text copied from them arrives formatted.)
- **The nearest closing symbol wins:** `*a* b*` is **a** then ` b*`.
- **They nest:** `*_bold italic_*` and `_*italic bold*_`.
- **Code, monospace and links are read first, and nothing inside them is formatted.** An underscore in a
  URL never makes it italic, and `` `a*b*c` `` shows its asterisks.
- **Links:** `http://`, `https://` or `www.` at the start of a word, as before. Punctuation after a link
  isn't part of it (`see example.com.`); a `)` is, while the link's own brackets need it (a Wikipedia
  page); and symbols that close formatting opened just before it aren't (`*https://x.com*` is a bold link).
- **Line markers need their space** (`- `, `* `, `1. `, `> `) and some text after it. `-1 degrees` and
  `1.5 kg` stay as typed. Up to three digits for a number.
- **A line break at the very end** shows no empty line after it.

The rules live in two files kept line for line the same: `frontend/src/utils/textFormat.js` and
`mobile/src/lib/textFormat.ts`. **`node scripts/check-text-format.mjs`** runs both against the same
cases and fails if either gets one wrong or they disagree. Add a case there with any change.

## 3. How it looks

| | Website (`components/FormattedText`) | App (`src/components/FormattedText.tsx`) |
|---|---|---|
| Bold | 700 | `Inter_700Bold` |
| Italic | italic | `Inter_400Regular_Italic` |
| Bold italic | 700 italic | `Inter_700Bold_Italic` (loaded for this) |
| Strikethrough | line-through | `textDecorationLine: 'line-through'` |
| Code and monospace | the system monospace face at 0.9 of the text size | Menlo (iOS), `monospace` (Android), 0.9 of the text size |
| Inline code's tint | the text's own colour at 12% (`color-mix`) | `formatCodeMine` `rgba(255,255,255,0.12)` · `formatCodeTheirs` `rgba(26,26,26,0.12)` |
| Inline code's shape | padding 0.1em / 0.3em, radius 4 | no padding (React Native can't pad inline text) |
| Bullet and numbered item | the marker in its own column (about 10 px, centred), then 6 px; wrapped lines start under the text | the same |
| Quote | a 3 px bar, radius 2, in the text's own colour at 45%, then 7 px to the text (10 in all); quote lines in a row join into one bar | `formatQuoteBarMine` `rgba(255,255,255,0.45)` · `formatQuoteBarTheirs` `rgba(26,26,26,0.45)` |
| Links | the surface's own link colour, underlined (chat: `blueLight` on a sent bubble, `blueDark` on a received one; posts: `purple`) | the same |

The colour of everything else is the text's own, so the same text reads on a sent bubble, a received
one and the community wallpaper.

**Line markers in the page (website).** Each line `FormattedText` draws carries
`data-fmt="text" | "bullet" | "number" | "quote"`. A numbered line also carries `data-marker` with its
number as typed (for example `"2."`). The bullet or number drawn in front carries `data-fmt="marker"`.
This is what lets text copied from Yahora paste back in with its lines (§4).

**Emoji** keep their rules (MESSAGES_SPEC §2 "Emoji in messages"): larger inside text, formatted or not,
and a message of only 1 to 3 emoji is drawn jumbo with no formatting.

**Where it's drawn:**

- **Chat bubbles,** both platforms.
- **Community posts and replies:** the website. The app's community (built in V-D) still draws posts
  and replies as plain text; it should use `FormattedText` the same way.

**Previews show the text without its symbols,** on one line: the inbox's last message, a reply's quote
inside a bubble, and the reply bar over the composer. A bullet keeps its `•`, a number its `1.`; a
quote loses its `>`. Double symbols are removed like single ones. (`plainText()` in the same two files.)

**Line breaks show on the website too.** Each line is its own block, so a message written with
Shift + Enter keeps its breaks in a web bubble. Before this, the web chat ran a multi-line message
together on one line; the app always showed the breaks.

## 4. Pasting (website)

Pasting rich text into the chat composer or a community composer keeps its formatting, as WhatsApp
Web and Telegram do. A Google Doc, ChatGPT's answer, a web page, Telegram Web, or a post copied from
Yahora itself comes in as the symbols above:

| Copied | Becomes |
|---|---|
| bold (`<b>`, `<strong>`, a heading, a table header, `font-weight` 600 or more) | `*…*` |
| italic (`<i>`, `<em>`, `font-style: italic`) | `_…_` |
| strikethrough (`<s>`, `<del>`, `line-through`) | `~…~` |
| inline code (`<code>`, `<kbd>`, or a monospace font: Courier, Consolas, Menlo, Monaco, SF Mono, `monospace`) | `` `…` `` |
| a code block: **only `<pre>`** | ` ```…``` ` |
| a list item | `- ` or `1. ` (an ordered list keeps its start number) |
| a blockquote | `> ` on each line |
| a table row | one line, cells a space apart |
| a Yahora line (`data-fmt`, §3) | `bullet` → `- ` · `number` → its `data-marker` and a space · `quote` → `> ` · `text` → the line as it is. Elements with `data-fmt="marker"` are skipped, so the drawn `•` or `2.` isn't pasted twice |

- **`white-space` alone means nothing.** Google Docs puts `white-space: pre-wrap` on every span, so
  only a `<pre>` element becomes a ` ``` ` block.
- A pair of symbols is written only where §2 would read it back as formatting. Bold in the middle of a
  word comes in plain, because `He*llo*` would just show its asterisks. Spaces stay outside the symbols.
- Formatting can't cross a line, so it is closed at the end of each line and opened again on the next.
- Links come in as their text. Images, buttons and scripts in the copied text are left out.
- **If nothing in the paste is formatted, the browser pastes as usual.** The formatted paste goes in
  through the browser's own insert, so Undo works.
- **Image files on the clipboard,** in the post composer only (not a reply): attached through the
  composer's `addPhotos`, with all its rules (3 at most, JPEG / PNG / WebP, 5 MB each, never with a
  GIF), and its own messages when one is broken. Text on the same clipboard is pasted as usual. The
  reply box and the chat ignore image files.
- **The app can't paste rich text:** a phone's text box is only ever given plain text. WhatsApp's own
  symbols are plain text, so a message copied from WhatsApp keeps its formatting in the app as well.

`frontend/src/utils/pasteFormat.js`.

## 5. Typing

### 5.1 Website: formatting while typing (the overlay)

The textarea's text is invisible (its caret and selection still show), and a mirror layer under it
draws the same text, formatted. Every character must keep its exact position, so the box only uses
looks that don't change a character's width:

| In the box | Looks like |
|---|---|
| The symbols themselves | the text colour at 45% |
| Bold | `-webkit-text-stroke` of about 0.035em in `currentColor` |
| Strikethrough | line-through |
| Italic | the text colour at 70% (a lighter shade; true italic is wider) |
| `` `code` `` and ` ``` ` | a tint of the text colour at 12%, **no padding** |
| Links | underlined |

Lines starting `- `, `* `, `1. ` or `> ` show as typed. Sent messages and posts keep the real look
of §3.

### 5.2 Website: shortcuts (the chat box and the post composer)

| Keys | Wraps in |
|---|---|
| Ctrl/Cmd + B | `*bold*` |
| Ctrl/Cmd + I | `_italic_` |
| Ctrl/Cmd + Shift + X | `~strike~` |
| Ctrl/Cmd + Shift + M | ` ```monospace``` ` |

- They wrap the selection. If it is already wrapped (the symbols inside the selection's edges or just
  outside them), the same keys remove them.
- Spaces at the edges of the selection stay outside the symbols.
- With no selection, a pair is inserted with the cursor between.
- A selection over several lines is wrapped line by line.
- **Code and monospace are protected** (nothing inside them is formatted, §2), so the tools work
  around them (17 Nov):
  - Bold, italic or strike on text inside code or monospace wraps **outside** the backticks:
    `` `exam` `` + strike → `` ~`exam`~ ``, and strike again takes it off. Where that would cross a line
    (inside multi-line monospace), they do nothing.
  - Code on monospace, or monospace on code, **switches the markers** (`` ` `` ↔ ` ``` `) instead of
    nesting them; the active one again removes it.
  - Code or monospace over text that has code inside drops those inner markers first.
  - The rules are `planFormat` in `frontend/src/utils/formatSelection.js`, kept line for line with the
    app's `mobile/src/components/FormatToolbar.tsx`, and checked on both by
    `scripts/check-format-selection.mjs`.
- Undo restores the text exactly.

### 5.3 Website: the selection bar

With text selected in the box, a small bar sits just above the selection:
**B · I · S · code (`` ` ``) · monospace (` ``` `)**, doing what the shortcuts do. It hides on Esc, a
click elsewhere, or an empty selection. On touch screens it sits just above the text box instead,
because the phone's own copy / paste bubble covers the selection.

### 5.4 App: formatting while typing

Real formatting inside the text box (styled text children of the `TextInput`): `Inter_700Bold`,
`Inter_400Regular_Italic`, `Inter_700Bold_Italic`, line-through, the mono font, and the symbols at 45%.

If a platform proves unreliable (the cursor jumps, keyboard suggestions break), live formatting is off
on that platform only, and this section says so.

Built in TF-7 as `mobile/src/components/FormattedInput.tsx`, used by the chat box. Sizes never change
(code and monospace keep the box's size, unlike a sent message's 0.9), so a line never grows while
typing. The symbols use `formatSymbolInput` (`blackSoft` at 45%), code `formatCodeTheirs`.
**Live formatting is on on both iOS and Android.** It has not yet been checked on a phone; if it
proves unreliable on one, `LIVE_FORMAT` in that file turns it off there, and this line says so.

### 5.5 App: selection tools and the chat limit

**An Aa button, then a Yahora bar just below the chat box** (the owner's choice, 17 Nov). While text
is selected in the box (and it has focus and the keyboard is up), the ☺ button beside the box turns
into an **Aa** button: purple on `demoCardPurpleBg`. Tapping it opens **B · I · S · code · monospace**,
a small white pill just below the box, and fills Aa purple with white letters; tapping Aa again closes
it. The bar closes, and ☺ comes back, when the box loses focus, the keyboard closes, the user types or
taps in the text. The pill is centred in 56 px of room (`FORMAT_ROOM`): the composer grows by that much
over the bottom of the message list, which keeps its size (the thread reaches under the composer), so no
message moves; the jump-to-latest button and the toast rise with it.

**Why a button first.** The phone's own Cut / Copy / Paste menu floats above **or** below the box
(Android chooses, and an app can't move it), so it covered a bar placed there right away. It never sits
on the box's own line, where Aa is, and it closes the moment anything of ours is tapped, so the bar opens
with nothing over it.

**The phone's own menu and handles stay.** Selecting works as everywhere else on the phone: long-press
a word, drag the handles to any range, and the phone's own Cut / Copy / Paste / Share menu, which
Android places next to the selection (usually above the box).

**What was tried before (TF-7, 17 Nov).** A row just above the box was covered by the phone's menu. Under
the header nothing covered it, but it was far from the text (the owner moved it back below the box).
Hiding the phone's menu in the chat box (`contextMenuHidden`), with Cut · Copy · Paste in our bar, took
away Android's drag handles too (Android shows them only with its menu, and drops the selection when the
menu is refused), so only one word could be selected. A bar shown straight away below the box was
covered when Android put its menu below the selection.

- **Formatting:** the website's wrap / unwrap rules (§5.2), including protected code and monospace,
  ported line for line to `applyFormat` in `mobile/src/components/FormatToolbar.tsx`. Afterwards the
  same words are selected, so a second tap takes the symbols off. There is no Undo for this; tapping
  again is the undo.
- **The selection the buttons act on.** Touching the bar closes the phone's menu, and Android drops
  the box's selection with it, before the button runs. So the chat keeps the last non-empty selection
  itself and every button uses that one. A collapsed selection never ends it; typing, a tap in the box,
  the box losing focus or the keyboard closing do. Buttons act on finger-down. After a change the box
  is held to the new selection until it reports it back. After a tap on the bar the words stay
  selected, but Android may not show its handles and menu again until the next long-press.

The pill is 48 px tall (`FORMAT_ROW_HEIGHT`), white, radius 14, with the community quick bar's raised
shadow (`shadows.quickBarRaised`: a hairline ring and a soft lift), like the website's selection bar.
Each button is a 44 × 44 touch target with no fill: an icon from the app's set (MaterialCommunityIcons,
`blackSoft`, 20) and an accessibility label; pressed, it turns `pinkBg` with a `purple` icon. A thin
divider separates the text looks (B · I · S) from the code looks (code · monospace). It fades in (150 ms) and out
(120 ms), and each tap gives a light haptic.

**The chat limit (MESSAGES_SPEC §2):** the box never cuts text (no `maxLength`); the length is counted
in code points (`[...text].length`), as the server counts. From 100 left, the number left shows above
Send (Inter 600 12, `mutedText`), red (`errorText`) at 0 and below, with a plain minus ("-12"). Send is
disabled above 2,000. The emoji picker refuses an emoji that would go over, counted the same way.
The app's counter is this plain number, not the website's ring (§5.6).

### 5.6 Website: the character counter

The chat box (2,000) and the post and reply composer (1,000) show **the same counter**,
`components/CharCounter` (`{ length, max }`): a progress ring that fills by length / max (never
past full). Characters are counted in code points (one emoji is one), as the server counts.

| Left | Ring | Number |
|---|---|---|
| more than 100 | 20 px, a "rainbow" ring: its colour follows how full it is (below) | none |
| 100 to 1 | grows to 26 px, keeps its rainbow colour (by then yellow → orange) | the number left, inside the ring, Inter 600 11, `blackSoft` (readable on any ring colour) |
| 0 and below | 26 px, `errorText`, full | `max − length` (`0`, `-500`: a plain minus, no space) just to the ring's left, Inter 600 12, `errorText` |

- **The ring:** stroke 2.5 px, round end, starting at the top, on a track in `communityHairline`.
- **The rainbow (`counterRainbow`):** the colour is computed from the fill, interpolated in HSL
  between these stops, not drawn as a gradient image:

  | Fill | 0% | 20% | 40% | 60% | 80% | 95% and after |
  |---|---|---|---|---|---|---|
  | Colour | purple `#800080` | blue `#2563EB` | teal `#0D9488` | green `#16A34A` | yellow `#CA8A04` | orange `#EA580C` |

  **Red is never part of it:** red means only "over the limit".
- **It always takes the same width** (the 26 px ring, 4 px, and room for a minus and every digit
  of the max), so nothing around it moves when the ring grows or the number appears.
- **Motion:** colour, size and fill change over 150 ms (`communityEase`). The moment the text goes
  over the limit, the counter shakes once, about 4 px over 250 ms. With reduced motion: no shake
  and no transitions.
- **Screen readers:** `role="status"`, `aria-live="polite"`, labelled `40 characters left` or
  `500 characters over the limit`.
- **Where:** in the chat, between the box and Send, always shown. In the post and reply composer,
  after the tools, so it opens and closes with them (a closed composer shows no ring).
- The box never cuts text. Send / Post is off above the limit.

## 6. Copying

- **A message's Copy** (MESSAGES_SPEC §10.7) and **a post's Copy text** (new, COMMUNITY_SPEC §3) copy the
  text as typed, with its symbols.
- **A post's Copy link** copies `https://<website>/post/<id>` (the website's `/post/:id` page). For a
  reply, its parent post's link.
- **Selecting text with the mouse on the website:** the browser's own copy.
- **Toasts:** `Text copied`, `Link copied`, `Couldn't copy`.

## 7. Plain on purpose

**Product descriptions, product comments and bios** stay plain text.
