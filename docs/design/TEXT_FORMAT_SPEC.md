# Text formatting — design spec

**Version 1 · 7 November 2026 · for chat messages and community posts, on the website and the app**

People copy text between WhatsApp, Telegram and Yahora all day. WhatsApp writes its formatting as
plain-text symbols (`*bold*`), so a copied message used to arrive here with its asterisks showing.
Yahora now reads those symbols the way WhatsApp does, on both platforms, everywhere a message or a
post is shown in full.

`MESSAGES_SPEC.md` (§2 "Formatting") and `COMMUNITY_SPEC.md` (§3 "Text") point here. Change the
rules here first, then both platforms.

---

## 1. Stored as typed

**Nothing changes in the database or the API.** A message or post is stored exactly as typed,
symbols and all, as WhatsApp stores it. Only the screen draws it formatted. So:

- **Copy** (the message menu) copies the symbols, and pasting into WhatsApp formats it there too.
- The **character limits** count the symbols (2,000 for a message, 1,000 for a post), as WhatsApp does.
- An older client simply shows the symbols.
- Moderation reads the text with its symbols, which doesn't change what it finds.

## 2. The rules (WhatsApp's)

| Type | Shows as | Where |
|---|---|---|
| `*bold*` | **bold** | within one line |
| `_italic_` | *italic* | within one line |
| `~strikethrough~` | ~~strikethrough~~ | within one line |
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
`mobile/src/lib/textFormat.ts`. **`node scripts/check-text-format.mjs`** runs both against 73 cases and
fails if either gets one wrong or they disagree. Add a case there with any change.

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

**Emoji** keep their rules (MESSAGES_SPEC §2 "Emoji in messages"): larger inside text, formatted or not,
and a message of only 1 to 3 emoji is drawn jumbo with no formatting.

**Where it's drawn:**

- **Chat bubbles,** both platforms.
- **Community posts and replies** (website now; the app when its community is built).

**Previews show the text without its symbols,** on one line: the inbox's last message, a reply's quote
inside a bubble, and the reply bar over the composer. A bullet keeps its `•`, a number its `1.`; a
quote loses its `>`. (`plainText()` in the same two files.)

**Line breaks show on the website too.** Each line is its own block, so a message written with
Shift + Enter keeps its breaks in a web bubble. Before this, the web chat ran a multi-line message
together on one line; the app always showed the breaks.

## 4. Pasting formatted text (website)

Pasting rich text into the chat composer or a community composer keeps its formatting, as WhatsApp
Web and Telegram do. A Google Doc, ChatGPT's answer, a web page, Telegram Web, or a post copied from
Yahora itself comes in as the symbols above:

| Copied | Becomes |
|---|---|
| bold (`<b>`, `<strong>`, a heading, a table header, `font-weight` 600 or more) | `*…*` |
| italic (`<i>`, `<em>`, `font-style: italic`) | `_…_` |
| strikethrough (`<s>`, `<del>`, `line-through`) | `~…~` |
| inline code (`<code>`, `<kbd>`, a monospace font) | `` `…` `` |
| a code block (`<pre>`, `white-space: pre`) | ` ```…``` ` |
| a list item | `- ` or `1. ` (an ordered list keeps its start number) |
| a blockquote | `> ` on each line |
| a table row | one line, cells a space apart |

- A pair of symbols is written only where §2 would read it back as formatting. Bold in the middle of a
  word comes in plain, because `He*llo*` would just show its asterisks. Spaces stay outside the symbols.
- Formatting can't cross a line, so it is closed at the end of each line and opened again on the next.
- Links come in as their text. Images, buttons and scripts are left out.
- **If nothing in the paste is formatted, the browser pastes as usual.** The formatted paste goes in
  through the browser's own insert, so Undo works.
- **The app can't do this:** a phone's text box is only ever given plain text. WhatsApp's own symbols are
  plain text, so a message copied from WhatsApp keeps its formatting in the app as well.

`frontend/src/utils/pasteFormat.js`.

## 5. Not built (on purpose, for now)

- **Formatting while typing.** WhatsApp's app shows bold inside the text box as you type. Here the box
  shows the symbols, and the message shows the formatting.
- **A formatting toolbar** for selected text (B / I / S / code).
- **Product descriptions and comments** stay plain text.
