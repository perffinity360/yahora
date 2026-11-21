/* frontend/src/utils/doubleClickReply.js

   Double-click to reply, with a mouse only (COMMUNITY_SPEC §3 and §4,
   MESSAGES_SPEC §10.4): double-clicking an EMPTY part of a post, a reply or a
   message starts a reply. Never on text (a double-click there selects a word),
   nor on anything with a job of its own.

     MOUSE                   the media query: a fine pointer that can hover
     NOT_BLANK               what a double-click must never start on
     onBlank(e, notBlank)    the double-click started on empty space
*/

export const MOUSE = "(hover: hover) and (pointer: fine)";

export const NOT_BLANK = [
  "a, button, input, textarea, select, label, img, video, picture, svg",
  "[role='button'], [role='menu'], [role='dialog'], [role='toolbar'], [role='checkbox']",
].join(", ");

/* Whether (x, y) is on a character of text, not just inside the box around it. */
function pointOnText(x, y) {
  let node = null;
  let offset = 0;
  const pos = document.caretPositionFromPoint?.(x, y);
  if (pos) {
    node = pos.offsetNode;
    offset = pos.offset;
  } else {
    const range = document.caretRangeFromPoint?.(x, y);
    if (!range) return false;
    node = range.startContainer;
    offset = range.startOffset;
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;
  const range = document.createRange();
  for (const at of [offset - 1, offset]) {
    if (at < 0 || at >= node.length) continue;
    range.setStart(node, at);
    range.setEnd(node, at + 1);
    for (const r of range.getClientRects()) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
  }
  return false;
}

/* The double-click started on empty space: not on anything matching
   `notBlank` (NOT_BLANK plus the caller's own), and not on text. */
export function onBlank(e, notBlank = NOT_BLANK) {
  if (!(e.target instanceof Element) || e.target.closest(notBlank)) return false;
  return !pointOnText(e.clientX, e.clientY);
}

/* With a mouse, right now. */
export function hasMouse() {
  return typeof window !== "undefined" && window.matchMedia(MOUSE).matches;
}
