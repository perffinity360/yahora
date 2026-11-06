---
date: 2026-11-07T00:07:46+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "WhatsApp-style formatting in messages and posts (Messages.jsx edited)"
---

# WhatsApp-style formatting in messages and posts (Messages.jsx edited)

Messages and community posts are now drawn the way WhatsApp draws them: `*bold*`, `_italic_`,
`~strike~`, `` `code` ``, ` ```monospace``` `, `- ` bullets, `1. ` numbered items and `> ` quotes,
with links. Text is stored exactly as typed, so **no database or API change**. Branch
`v-text-formatting`, cut from `v-p-web-community-redesign`, so it merges after V-P. The spec is
`docs/design/TEXT_FORMAT_SPEC.md`.

## ⚠ Your files

**`frontend/src/pages/messages/Messages.jsx` and `Messages.module.css` were edited.** They aren't
part of the V-P loan, and the owner asked for the web chat to get this too. What changed:

- `MessageText` draws through the new `components/FormattedText` (jumbo emoji unchanged; inline emoji
  through a `renderText` callback, `withInlineEmoji`).
- The reply quote, the inbox preview and the reply bar show `plainText(...)`: the text without
  its symbols.
- The chat textarea has `onPaste={pasteFormatted}`.
- `Messages.module.css`: `.messageLink`, in the spec's link colours (`--blue-light` on a sent
  bubble, `--blue-dark` on a received one).

**Two web chat bugs are fixed as a side effect.** Bubbles didn't draw links (MESSAGES_SPEC §2 gives
them colours; the app always drew them), and a message with line breaks ran together on one line,
because `.messageText` had no `white-space: pre-wrap`. Each line is now its own block.

## New shared pieces (frontend)

| File | What it does |
|---|---|
| `src/utils/textFormat.js` | The rules: `parseFormatted(text)`, `plainText(text)`. Twin of `mobile/src/lib/textFormat.ts`, line for line |
| `src/components/FormattedText/` | Draws one block per line inside your own `<p>` or `<div>`. Props: `content`, `renderText`, `linkClassName` |
| `src/utils/pasteFormat.js` | `onPaste={pasteFormatted}` on a textarea: rich text pasted from Google Docs, ChatGPT or a web page comes in as the symbols; plain pastes are untouched |
| `scripts/check-text-format.mjs` | `node scripts/check-text-format.mjs` runs both twins against 73 cases |

`utils/community.js`: `splitLinks` is removed. `PostText` uses `FormattedText` now, so the community
gets formatting for free.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. The stored text is unchanged; only how it is drawn changed.

## New fields on existing responses

None.

## Test data

None needed. Send this, then paste a paragraph with some bold in it from a Google Doc into the chat:

```
*bold* _italic_ ~strike~ `code`
- a bullet
1. a numbered item
> a quote
```

## What NOT to do yet

- **Don't render message or post text by hand** (splitting links, emoji…) in a new place. Use
  `FormattedText` for full text and `plainText()` for one-line previews, so the app and the website
  keep agreeing. If a rule changes, change both `textFormat` files and add a case to the script.
- **`footer.module.css` leaks bare `a { text-decoration: none; transition: all }`, `a:hover { color:
  var(--pink-light) }`, `ul` and `li` rules to the whole site.** A hovered username in the community
  turned near-white because of it. The community and chat now set their own hover colours. Scoping
  the footer's rules to `.footer` is the real fix, but it would change links across the site, so it's
  your call. It's written up in `frontend/DESIGN.md` "Quality floor".
- The app's half of this work (`mobile/`) is waiting for Vishwajeet to commit, so `main` won't have the
  app side, or `scripts/check-text-format.mjs`, until he does.
