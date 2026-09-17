export interface University {
  id: string;
  name: string;
  domain: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  university_id: string;
  full_name: string | null;
  avatar_url: string | null;
  qualification: string | null;
  course_id: string | null;
  specialization_id: string | null;
  year_of_study: string | null;
  bio: string | null;
  is_profile_complete: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  university_id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  image_urls: string[];
  status: string;
  condition: string | null;
  location: string | null;
  views: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

/**
 * A marketplace feed row (GET /api/products): the full product plus the joined
 * seller and the viewer's interaction state. Structurally satisfies
 * `ProductCardItem`, so `ProductCard` renders it directly.
 */
export interface MarketplaceProduct extends Product {
  seller: { id: string; full_name: string | null; avatar_url: string | null };
  is_liked?: boolean;
  is_saved?: boolean;
}

/** A single Q&A comment (or reply) on a product — rendered in the detail
 *  screen's thread (part 2). `user_vote` is the viewer's own up/down state. */
export interface ProductComment {
  id: string;
  content: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  parent_comment_id: string | null;
  user: { id: string; full_name: string | null; avatar_url: string | null };
  user_vote: -1 | 0 | 1;
}

/**
 * The full product-detail payload (GET /api/products/:id): every product field
 * plus the joined seller, the comment thread, and the viewer's interaction
 * state. Superset of `Product`, so it slots into `ProductCardItem` too.
 */
/**
 * The backend's cursor-paginated list envelope — `sendPage()` in
 * backend/src/utils/respond.js, as of Phase 4 Block N-B (2026-09-15).
 *
 * This is a WIRE type. It should not travel further than the hook that fetched
 * it: hooks in src/hooks unwrap it and cache the plain array, so screens and
 * components never have to know which endpoints are paged. When Phase 5 adds
 * infinite scroll, `next_cursor` is read in those same hooks.
 */
/**
 * `GET /api/users/username-available`. `available: true` comes back on its own;
 * a refusal carries the reason and up to three alternatives.
 *
 * `reason` is a LABEL for a decision the database already made, not a second
 * opinion (backend/API.md). Note TAKEN and RESERVED must render the SAME
 * sentence to a student — see UsernameField.
 */
export interface UsernameAvailability {
  available: boolean;
  reason?: 'TAKEN' | 'RESERVED' | 'INVALID_FORMAT' | 'RECENTLY_RELEASED';
  suggestions?: string[];
}

/** `GET /api/users/username-suggestions?name=` */
export interface UsernameSuggestions {
  suggestions: string[];
}

export interface Paged<T> {
  items: T[];
  next_cursor: string | null;
}

export interface ProductDetailData extends Product {
  seller: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    qualification: string | null;
    year_of_study: string | null;
  };
  /**
   * Unwrapped by `useProductDetail` / `useProduct`. On the wire this is
   * `Paged<ProductComment>` — see `ProductDetailWire` below.
   */
  comments: ProductComment[];
  is_liked?: boolean;
  is_saved?: boolean;
}

/**
 * `GET /api/products/:id` exactly as it comes off the wire. The only difference
 * from `ProductDetailData` is `comments`, which N-B turned from an array into a
 * paged envelope. Used only by the two hooks that unwrap it.
 */
export type ProductDetailWire = Omit<ProductDetailData, 'comments'> & {
  comments?: Paged<ProductComment> | null;
};

/**
 * A product row as returned by the dashboard / public-profile endpoints. It is
 * the shared shape the reusable `ProductCard` renders. A full marketplace
 * `Product` (which additionally carries `seller_id`/`university_id`) is
 * structurally assignable to this, so the card works everywhere.
 * `is_liked`/`is_saved` are only present when a viewer's interaction state is
 * attached (public profile / marketplace — used in 4b/4c).
 */
export interface ProductListing {
  id: string;
  title: string;
  description: string | null;
  category: string;
  condition: string | null;
  location: string | null;
  price: number;
  status: string;
  image_urls: string[];
  created_at: string;
  likes_count: number;
  views: number;
  comments_count: number;
  is_liked?: boolean;
  is_saved?: boolean;
}

/**
 * The minimal product shape the reusable `ProductCard` renders. Both a
 * dashboard `ProductListing` and a public-profile `PublicListing` satisfy it
 * (the public endpoint omits location/comments/description).
 */
export interface ProductCardItem {
  id: string;
  title: string;
  price: number;
  condition: string | null;
  status: string;
  image_urls: string[];
  created_at: string;
  likes_count: number;
  views: number;
  comments_count?: number;
  location?: string | null;
  is_liked?: boolean;
  is_saved?: boolean;
}

/* ────────────────────────── Messaging ────────────────────────── */

/** A row of the `messages` table, exactly as realtime and the REST API return it. */
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  product_id: string;
  university_id: string;
  content: string;
  is_read: boolean;
  is_delivered: boolean;
  created_at: string;
}

/**
 * One conversation summary from GET /api/messages/inbox/:userId (the
 * `get_user_inbox` RPC) — one row per contact + product, newest first.
 */
export interface InboxItem {
  contact_id: string;
  contact_name: string | null;
  contact_avatar: string | null;
  product_id: string;
  product_title: string | null;
  product_image: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
}

/**
 * A message in the chat cache, which also holds not-yet-confirmed sends.
 *
 * A confirmed message is identified by its server `id`; an optimistic one by its
 * `client_tag` (its `id` is the tag until the server replies). Every insert path
 * must check BOTH before appending, or the same bubble shows up twice.
 */
export type PendingMessage = Message & {
  pending?: boolean;
  failed?: boolean;
  client_tag?: string;
};

/** Read-only profile as returned by GET /api/user/:id/public. */
export interface PublicProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  qualification: string | null;
  year_of_study: string | null;
  created_at: string;
  courseName?: string;
  specializationName?: string;
  university?: string;
}

/** A listing row from the public-profile endpoint (available items only). */
export interface PublicListing {
  id: string;
  title: string;
  price: number;
  image_urls: string[];
  created_at: string;
  views: number;
  likes_count: number;
  condition: string | null;
  status: string;
  is_liked?: boolean;
  is_saved?: boolean;
}

export interface PublicProfileData {
  profile: PublicProfile;
  listings: PublicListing[];
}

export interface Purchase {
  id: string;
  created_at: string;
  product: {
    id: string;
    title: string;
    price: number;
    image_urls: string[];
  };
}

/** Flattened profile the dashboard/public-profile endpoints return: the users
 *  row plus the joined course/specialization/university display names. */
export type DashboardProfile = UserProfile & {
  courseName?: string;
  specializationName?: string;
  university?: string;
};

export interface DashboardData {
  profile: DashboardProfile;
  listings: ProductListing[];
  purchases: Purchase[];
}
