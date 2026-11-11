// frontend/src/hooks/useReactionPatches.js
//
// Reactions on posts (spec §5), optimistic. Every screen that lists posts
// keeps their reaction answers by post id in `patches` and lays them over its
// own copy of each post, so a reaction shows everywhere that post is loaded.
//
//   onReact(postId, emoji | null, before?) → Promise<true | false | null>
//
// `before` is the post as it shows now: the patch shows the new reaction at
// once, and the API's answer replaces it. If the API refuses, the patch goes
// back to what it was. Only the latest press on a post decides, so a quick
// second press isn't undone by the first one's answer. Never rejects: true
// (done), false (refused), null (superseded by a later press). A reply's like
// isn't in any list, so it passes no `before` and rolls itself back on false.

import { useCallback, useRef, useState } from "react";
import { react, unreact } from "../pages/community/api";

/* The post as it looks once `emoji` is your reaction (null removes it):
   one reaction per person, a new one replaces the old. */
function withReaction(post, emoji) {
  const counts = { ...(post.reaction_counts ?? {}) };
  const old = post.viewer_reaction;
  if (old) {
    counts[old] = (counts[old] ?? 1) - 1;
    if (counts[old] <= 0) delete counts[old];
  }
  if (emoji) counts[emoji] = (counts[emoji] ?? 0) + 1;
  return {
    viewer_reaction: emoji,
    reactions_total: Object.values(counts).reduce((a, b) => a + b, 0),
    reaction_counts: counts,
  };
}

export default function useReactionPatches() {
  const [patches, setPatches] = useState({});
  const patchesRef = useRef(patches);
  patchesRef.current = patches;
  const reactSeq = useRef({});

  const onReact = useCallback(async (postId, emoji, before) => {
    const seq = (reactSeq.current[postId] ?? 0) + 1;
    reactSeq.current[postId] = seq;
    const latest = () => reactSeq.current[postId] === seq;
    const previous = patchesRef.current[postId];
    if (before) setPatches((prev) => ({ ...prev, [postId]: withReaction(before, emoji) }));
    try {
      const answer = emoji ? await react(postId, emoji) : await unreact(postId);
      if (latest()) {
        setPatches((prev) => ({
          ...prev,
          [postId]: {
            viewer_reaction: answer.viewer_reaction ?? null,
            reactions_total: answer.reactions_total,
            reaction_counts: answer.reaction_counts ?? {},
          },
        }));
      }
      return true;
    } catch {
      if (latest() && before) {
        setPatches((prev) => {
          const next = { ...prev };
          if (previous) next[postId] = previous;
          else delete next[postId];
          return next;
        });
      }
      // Superseded by a later press: that one decides, so nothing rolls back.
      return latest() ? false : null;
    }
  }, []);

  return { patches, onReact };
}

/** A list of posts with the patches laid over them. */
export function applyPatches(items, patches) {
  return items.map((p) => (patches[p.id] ? { ...p, ...patches[p.id] } : p));
}
