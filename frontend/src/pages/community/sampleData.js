/* ⚠ SAMPLE DATA — Phase 7, Block N-D part 1 only. DELETE THIS FILE IN PART 2
   (CC-N4b), when src/pages/community/api.js takes over.

   Made-up posts shaped exactly like runbook Appendix A's PostItem, and
   answers shaped like the real routes (`{ items, next_cursor, can_post }`,
   the reaction answer of PUT/DELETE /api/posts/:id/reaction), so part 2 swaps
   the functions at the bottom for real requests and the screens don't
   change. Photos and avatars are URLs the site already shows (Home.jsx); the
   GIF is one of the chat stickers in public/stickers. */

const HOUR = 60 * 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

/** The signed-in student, as part 2 will learn it from the API. */
export const SAMPLE_VIEWER = {
  username: "arjun.mehta",
  name: "Arjun Mehta",
  avatar: "https://i.pravatar.cc/150?img=12",
  university: "IIITDM Kurnool",
  country_code: "IN",
};

/** GET /api/posts/countries — your country first, then A–Z. Germany is a
    country this student can view but not post in. */
export const SAMPLE_COUNTRIES = [
  { code: "IN", name: "India", is_mine: true },
  { code: "DE", name: "Germany", is_mine: false },
  { code: "AE", name: "United Arab Emirates", is_mine: false },
];

const AUTHORS = {
  rahul: {
    author_id: "a0000000-0000-0000-0000-000000000001",
    author_username: "rahul.verma",
    author_name: "Rahul Verma",
    author_avatar: "https://i.pravatar.cc/150?img=11",
    author_university: "IIITDM Kurnool",
  },
  priya: {
    author_id: "a0000000-0000-0000-0000-000000000002",
    author_username: "priya.nair",
    author_name: "Priya Nair",
    author_avatar: "https://i.pravatar.cc/150?img=5",
    author_university: "IIITDM Kurnool",
  },
  arjun: {
    author_id: "a0000000-0000-0000-0000-000000000003",
    author_username: "arjun.mehta",
    author_name: "Arjun Mehta",
    author_avatar: "https://i.pravatar.cc/150?img=12",
    author_university: "IIITDM Kurnool",
  },
  sneha: {
    author_id: "a0000000-0000-0000-0000-000000000004",
    author_username: "sneha.kapoor",
    author_name: "Sneha Kapoor",
    author_avatar: "https://i.pravatar.cc/150?img=9",
    author_university: "NIET Greater Noida",
  },
  lena: {
    author_id: "a0000000-0000-0000-0000-000000000005",
    author_username: "lena.weber",
    author_name: "Lena Weber",
    author_avatar: null,
    author_university: "TU Munich",
  },
  karan: {
    author_id: "a0000000-0000-0000-0000-000000000006",
    author_username: "karan.singh",
    author_name: "Karan Singh",
    author_avatar: "https://i.pravatar.cc/150?img=8",
    author_university: "IIITDM Kurnool",
  },
};

const PHOTOS = [
  "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&q=80&w=800",
];

function post(n, author, fields) {
  const counts = fields.reaction_counts ?? {};
  return {
    id: `p0000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    parent_post_id: null,
    scope: "campus",
    country_code: "IN",
    content: "",
    image_urls: [],
    gif: null,
    created_at: ago(HOUR),
    reactions_total: Object.values(counts).reduce((a, b) => a + b, 0),
    reaction_counts: counts,
    replies_count: 0,
    viewer_reaction: null,
    moderation_status: "active",
    ...AUTHORS[author],
    is_mine: author === "arjun",
    ...fields,
  };
}

/* Kept mutable: reacting changes these objects, so switching feeds and coming
   back shows the reaction you just made (part 1 has no server to remember it). */
const POSTS = [
  post(1, "rahul", {
    content: "Lost my calculator near Block C. Casio fx-991, my name is scratched on the back. Please DM if you find it 🙏",
    created_at: ago(4 * 60 * 1000),
    reaction_counts: { "🙏": 3, "😢": 1 },
    replies_count: 2,
  }),
  post(2, "priya", {
    content:
      "Okay, long one, but I promised the first-years a proper guide after last week's orientation, so here goes.\n\n" +
      "1. The library's third floor is the quiet floor. Phones on silent, and yes, the librarian will notice.\n" +
      "2. The canteen's masala dosa is best before 9 AM. After that, the batter is a gamble.\n" +
      "3. Lab manuals: buy them second-hand from seniors on Yahora — nobody needs a fresh copy of a book you'll use for one semester.\n" +
      "4. The shuttle to the city leaves at 5:30 PM on Fridays and it fills up by 5:20.\n" +
      "5. Join at least one club that has nothing to do with your branch. You'll thank me in third year.\n" +
      "6. Back up your project files. Then back them up again. Ask anyone who lost a semester project in a pen drive accident.\n" +
      "7. Hostel Wi-Fi drops around midnight every Sunday for maintenance, so don't plan submissions for then.\n\n" +
      "Anything I missed? Add it below. The full campus map is here: https://example.com/campus-map",
    created_at: ago(2 * HOUR),
    reaction_counts: { "❤️": 373, "😮": 95, "👍": 20, "🙏": 17, "😢": 13, "😂": 206 },
    replies_count: 14,
    viewer_reaction: "❤️",
  }),
  post(3, "karan", {
    content: "Selling my old desk lamp and headphones before I move out. Both work perfectly.",
    image_urls: [PHOTOS[0], PHOTOS[1]],
    created_at: ago(5 * HOUR),
    reaction_counts: { "👍": 6 },
    replies_count: 1,
  }),
  post(4, "arjun", {
    content: "Weekend ride to the hills, anyone? Leaving Saturday 6 AM 🚲",
    image_urls: [PHOTOS[4]],
    created_at: ago(26 * HOUR),
    reaction_counts: { "😮": 4, "❤️": 9, "👍": 2 },
    replies_count: 5,
  }),
  post(5, "rahul", {
    scope: "country",
    content: "Any good hackathons in November? Looking for a team too.",
    created_at: ago(1 * HOUR),
    reaction_counts: { "👍": 12, "😮": 1 },
    replies_count: 7,
  }),
  post(6, "sneha", {
    scope: "country",
    content: "Smart India Hackathon registrations close on the 14th. Don't miss it!",
    created_at: ago(3 * HOUR),
    reaction_counts: { "🙏": 41, "❤️": 18, "👍": 63 },
    replies_count: 3,
  }),
  post(7, "priya", {
    scope: "country",
    content: "When the exam is at 9 AM and the hostel mess opens at 9 AM",
    gif: {
      provider: "klipy",
      id: "sample-bear",
      url: "/stickers/bear.webp",
      preview_url: "/stickers/bear-still.webp",
      width: 360,
      height: 360,
    },
    created_at: ago(8 * HOUR),
    reaction_counts: { "😂": 1240, "❤️": 31 },
    replies_count: 22,
  }),
  post(8, "karan", {
    scope: "global",
    content: "Our room setup after a semester of collecting things from seniors 😄",
    image_urls: [PHOTOS[3], PHOTOS[2], PHOTOS[0]],
    created_at: ago(30 * 60 * 1000),
    reaction_counts: { "❤️": 4 },
    replies_count: 0,
  }),
  post(9, "lena", {
    scope: "global",
    country_code: "DE",
    content: "Exchange students — what's your favourite Indian dish?",
    created_at: ago(6 * HOUR),
    reaction_counts: { "❤️": 1_200_000, "😂": 54_000, "😮": 12_300 },
    replies_count: 13_400,
  }),
  post(10, "sneha", {
    scope: "global",
    content: "",
    image_urls: [PHOTOS[2]],
    created_at: ago(9 * 24 * HOUR),
    reaction_counts: {},
    replies_count: 0,
  }),
  post(11, "lena", {
    scope: "country",
    country_code: "DE",
    content: "Mensa is serving Käsespätzle today. That is the whole post.",
    created_at: ago(2 * HOUR),
    reaction_counts: { "😂": 8, "❤️": 3 },
    replies_count: 2,
  }),
  post(12, "lena", {
    scope: "country",
    country_code: "DE",
    content: "Does anyone know if the Garching library is open on Sunday?",
    created_at: ago(400 * 24 * HOUR),
    reaction_counts: { "👍": 1 },
    replies_count: 1,
  }),
];

/* Runbook §1.3. */
function hotScore(p) {
  const hours = (Date.now() - new Date(p.created_at).getTime()) / HOUR;
  return (p.reactions_total + 2 * p.replies_count + 1) / Math.pow(hours + 2, 1.5);
}

const byNew = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
const byHot = (a, b) => hotScore(b) - hotScore(a);

/* Small pages, so the infinite scroll has something to do with only 12
   posts. The real API pages by FEED_PAGE_SIZE. */
const SAMPLE_PAGE_SIZE = 4;

/** The feed routes (Appendix A #2–#4). `kind` is "campus", "country" or
    "global". The cursor is opaque to the caller, exactly as the API's is. */
export function sampleFeed(kind, { country, sort = "new", cursor = null } = {}) {
  let list;
  let canPost = true;
  if (kind === "campus") {
    // One post, one feed (decision of 2 November): only campus posts of the
    // viewer's campus, never their country or Global posts.
    list = POSTS.filter(
      (p) => p.scope === "campus" && p.author_university === SAMPLE_VIEWER.university,
    ).sort(byNew);
  } else if (kind === "country") {
    list = POSTS.filter((p) => p.scope === "country" && p.country_code === country);
    list.sort(sort === "hot" ? byHot : byNew);
    canPost = country === SAMPLE_VIEWER.country_code;
  } else {
    list = POSTS.filter((p) => p.scope === "global").sort(sort === "hot" ? byHot : byNew);
  }

  const start = cursor ? Number(cursor) : 0;
  const items = list.slice(start, start + SAMPLE_PAGE_SIZE).map((p) => ({ ...p }));
  const next = start + SAMPLE_PAGE_SIZE < list.length ? String(start + SAMPLE_PAGE_SIZE) : null;

  // A little delay, so the skeletons and the paging spinner are visible.
  return new Promise((resolve) =>
    setTimeout(() => resolve({ items, next_cursor: next, can_post: canPost }), 450),
  );
}

/** PUT /api/posts/:id/reaction (emoji) or DELETE (emoji = null). Returns the
    same answer shape as the API. */
export function sampleReact(postId, emoji) {
  const p = POSTS.find((x) => x.id === postId);
  if (!p) return null;
  const counts = { ...p.reaction_counts };
  if (p.viewer_reaction) {
    counts[p.viewer_reaction] = (counts[p.viewer_reaction] ?? 1) - 1;
    if (counts[p.viewer_reaction] <= 0) delete counts[p.viewer_reaction];
  }
  if (emoji) counts[emoji] = (counts[emoji] ?? 0) + 1;
  p.reaction_counts = counts;
  p.viewer_reaction = emoji;
  p.reactions_total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    post_id: p.id,
    viewer_reaction: p.viewer_reaction,
    reactions_total: p.reactions_total,
    reaction_counts: p.reaction_counts,
  };
}
