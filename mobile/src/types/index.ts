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
