// backend/src/utils/viewer.js
// ══════════════════════════════════════════════
// Written by VISHWAJEET   —   added in Phase 6B (Block V-A)
// Request to Neeraj - please import from this file; do not edit it.
// ══════════════════════════════════════════════
//
// THE IDENTITY RULE (Phase 6B):
//
//   A real student's identity — name, photo, @username, bio and academic
//   details — is shown only to signed-in students from real campuses.
//   Everyone else (logged-out visitors and demo accounts) still sees the
//   listings, but not the person behind them.
//
// Why demo accounts count as "everyone else": POST /api/auth/demo-login hands
// a real session to anyone, in one click, with no college email. A rule that
// trusted any signed-in caller would therefore protect nothing.
//
// The demo campus's own people are fictional personas and throwaway guests, so
// they are shown to everyone — that is what lets the demo work.
//
// Every place that returns a person goes through canSeeIdentity(). If you
// return a person without asking it, that is the bug this file exists to stop.
import { supabase } from '../config/supabase.js';

/**
 * Who is asking.
 *   kind: 'anonymous' — no valid token
 *         'demo'      — signed in, account on the demo campus
 *         'student'   — signed in, account on a real campus
 * A signed-in account with no users row or no campus is 'anonymous':
 * "I could not establish who you are" fails closed.
 *
 * Needs optionalAuth or requireAuth in front of the route (they set req.user).
 */
export async function resolveViewer(req) {
  const id = req.user?.id ?? null;
  if (!id) return { id: null, universityId: null, kind: 'anonymous' };

  const { data, error } = await supabase
    .from('users')
    .select('university_id, university:universities(is_demo)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.university_id || !data.university) {
    return { id, universityId: null, kind: 'anonymous' };
  }

  return {
    id,
    universityId: data.university_id,
    kind: data.university.is_demo === true ? 'demo' : 'student',
  };
}

// The demo campus never changes at runtime, so its id is cached for ten
// minutes rather than looked up on every request.
const DEMO_CACHE_MS = 10 * 60 * 1000;
let demoCache = { ids: null, at: 0 };

async function demoCampusIds() {
  if (demoCache.ids && Date.now() - demoCache.at < DEMO_CACHE_MS) return demoCache.ids;
  const { data, error } = await supabase.from('universities').select('id').eq('is_demo', true);
  if (error) throw error;
  demoCache = { ids: new Set((data ?? []).map((u) => u.id)), at: Date.now() };
  return demoCache.ids;
}

/** True only for the demo campus. Unknown or null ids are NOT demo (fail closed). */
export async function isDemoCampus(universityId) {
  if (!universityId) return false;
  return (await demoCampusIds()).has(universityId);
}

/**
 * May this viewer see the identity of a person who belongs to a campus?
 * `subjectIsDemo` is that campus's isDemoCampus() answer.
 */
export function canSeeIdentity(viewer, subjectIsDemo) {
  return viewer.kind === 'student' || subjectIsDemo === true;
}

/**
 * Remove the seller from a product row, in place. `seller_id` goes too: it is
 * the key to GET /api/user/:id/public, so leaving it would undo the point.
 * `seller_hidden: true` tells clients to draw "Yahora student" rather than
 * treating the missing seller as an error.
 */
export function hideSeller(product) {
  if (!product) return product;
  delete product.seller_id;
  product.seller = null;
  product.seller_hidden = true;
  return product;
}

/** Remove the author from every comment, in place. Comment text stays. */
export function hideCommenters(comments) {
  for (const comment of comments ?? []) {
    delete comment.user_id;
    comment.user = null;
    comment.user_hidden = true;
  }
  return comments;
}
