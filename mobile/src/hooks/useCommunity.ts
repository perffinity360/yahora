import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import { api } from '../lib/api';
import {
  applyReaction,
  FEED_PAGE_SIZE,
  REPLIES_PAGE_SIZE,
  withReaction,
  type FeedKind,
  type FeedSort,
} from '../lib/community';
import type { Country, FeedPage, Paged, PostItem, ReactionResult } from '../types';

/**
 * The community's reads and reactions — backend/API.md, "posts module (Phase 7)".
 * Every call goes through src/lib/api.ts, which adds the session token.
 *
 * ⚠ CURSORS ARE OPAQUE (runbook §1.3). A page's `next_cursor` goes back as
 * `?cursor=` exactly as it arrived; nothing here reads, builds or compares one.
 * A cursor belongs to one list and one sort, which is why the sort is part of
 * the query key: switching Hot ↔ New starts a new list from page one.
 *
 * Every key starts with 'community', so a reaction can find the post in
 * whichever feed or thread holds it.
 */

const FEEDS = ['community', 'feed'] as const;
const THREADS = ['community', 'replies'] as const;

export const feedKey = (kind: FeedKind, country: string | null, sort: FeedSort): QueryKey =>
  // The campus feed is always newest first and has no country.
  kind === 'campus' ? [...FEEDS, 'campus'] : [...FEEDS, kind, kind === 'country' ? country : null, sort];

function query(params: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

function feedPath(kind: FeedKind, country: string | null, sort: FeedSort, cursor?: string) {
  if (kind === 'campus') return `/api/posts/feed/campus${query({ limit: FEED_PAGE_SIZE, cursor })}`;
  if (kind === 'country') {
    return `/api/posts/feed/country/${encodeURIComponent(country ?? '')}${query({ sort, limit: FEED_PAGE_SIZE, cursor })}`;
  }
  return `/api/posts/feed/global${query({ sort, limit: FEED_PAGE_SIZE, cursor })}`;
}

/** `GET /api/posts/countries`: your country first, then the others by name.
 *  A country appears only once it has a live campus, so this changes rarely. */
export function useCountries() {
  return useQuery({
    queryKey: ['community', 'countries'],
    queryFn: () => api.get<Paged<Country>>('/api/posts/countries'),
    select: (page) => page?.items ?? [],
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * One feed, a page at a time. `select` flattens the pages into `posts` and
 * reads `can_post` from the first page (the campus feed has none: it's always
 * yours). Optimistic patches write to the cache, so they walk `pages[].items`.
 */
export function useFeed(
  kind: FeedKind,
  { country = null, sort = 'hot', enabled = true }: { country?: string | null; sort?: FeedSort; enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: feedKey(kind, country, sort),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.get<FeedPage>(feedPath(kind, country, sort, pageParam)),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    select: flattenFeed,
    enabled: enabled && (kind !== 'country' || !!country),
  });
}

function flattenFeed(data: InfiniteData<FeedPage>) {
  return {
    posts: data.pages.flatMap((page) => page?.items ?? []),
    // Undefined on the campus feed; true or false on the others.
    canPost: data.pages[0]?.can_post,
  };
}

/**
 * A post's replies beyond its `top_replies`, REPLIES_PAGE_SIZE at a time, in
 * the API's Hot order (spec §4 "Show more replies"). Nothing loads until the
 * thread asks (`enabled`). Hot scores refresh every 5 minutes, so a reply can
 * turn up on two pages: the thread keeps each id once.
 */
export function useThreadReplies(postId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...THREADS, postId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paged<PostItem>>(
        `/api/posts/${encodeURIComponent(postId)}/replies${query({ limit: REPLIES_PAGE_SIZE, cursor: pageParam })}`,
      ),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    enabled,
  });
}

type FeedCache = InfiniteData<FeedPage>;
type ThreadCache = InfiniteData<Paged<PostItem>>;

/** Lay a reaction over every cached copy of the post: in any feed (as a post or
 *  inside a post's `top_replies`) and in any open thread. */
function patchEverywhere(client: ReturnType<typeof useQueryClient>, result: ReactionResult) {
  const patch = <C extends FeedCache | ThreadCache>(data: C | undefined): C | undefined => {
    if (!data?.pages) return data;
    let changed = false;
    const pages = data.pages.map((page) => {
      if (!page?.items) return page;
      const items = page.items.map((item) => {
        const next = withReaction(item, result);
        if (next !== item) changed = true;
        return next;
      });
      return { ...page, items };
    });
    return changed ? ({ ...data, pages } as C) : data;
  };
  client.setQueriesData<FeedCache>({ queryKey: FEEDS }, patch);
  client.setQueriesData<ThreadCache>({ queryKey: THREADS }, patch);
}

/**
 * React to a post or a reply: `PUT /api/posts/:id/reaction` with an emoji, or
 * `DELETE` with null. One reaction per person (runbook §1.4): a new emoji
 * replaces yours, null removes it.
 *
 * Optimistic: the numbers change on screen at once in every cached copy, go
 * back if the server refuses, and then take the server's own numbers, which
 * also catch anyone else's reactions since the page loaded.
 *
 * Only the LATEST tap on a post may write its answer back. Two quick taps
 * (😂, then ❤️) can come back in either order; without this, the first answer
 * arriving last would put 😂 back on screen while the server holds ❤️.
 */
const latestTap = new Map<string, number>();
let tapCounter = 0;

export function useReactToPost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ post, emoji }: { post: PostItem; emoji: string | null; tap: number }) => {
      const path = `/api/posts/${encodeURIComponent(post.id)}/reaction`;
      return emoji ? api.put<ReactionResult>(path, { emoji }) : api.del<ReactionResult>(path);
    },
    onMutate: ({ post, emoji, tap }) => {
      latestTap.set(post.id, tap);
      // A feed refetch in flight would land with the old numbers on top.
      void client.cancelQueries({ queryKey: ['community'] });
      patchEverywhere(client, applyReaction(post, emoji));
    },
    onError: (_err, { post, tap }) => {
      if (latestTap.get(post.id) !== tap) return;
      // Back to what the post said when it was tapped.
      patchEverywhere(client, {
        post_id: post.id,
        viewer_reaction: post.viewer_reaction,
        reactions_total: post.reactions_total,
        reaction_counts: post.reaction_counts,
      });
    },
    onSuccess: (result, { post, tap }) => {
      if (latestTap.get(post.id) === tap && result?.post_id) patchEverywhere(client, result);
    },
    onSettled: (_r, _e, { post, tap }) => {
      if (latestTap.get(post.id) === tap) latestTap.delete(post.id);
    },
  });
}

/** `react(post, emoji | null)`: the one call the cards make. */
export function useReact() {
  const { mutate } = useReactToPost();
  return useCallback((post: PostItem, emoji: string | null) => {
    tapCounter += 1;
    mutate({ post, emoji, tap: tapCounter });
  }, [mutate]);
}
