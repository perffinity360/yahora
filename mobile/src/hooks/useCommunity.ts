import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import { api, type ApiError } from '../lib/api';
import { toUploadFile } from '../lib/upload';
import {
  applyReaction,
  distinctById,
  FEED_PAGE_SIZE,
  NEW_POSTS_POLL_MS,
  REPLIES_PAGE_SIZE,
  withReaction,
  type FeedKind,
  type FeedSort,
} from '../lib/community';
import type { Country, FeedPage, GifRef, Paged, PostItem, ReactionResult } from '../types';

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

const BY_USER = ['community', 'by-user'] as const;
const POSTS = ['community', 'post'] as const;

type ListCache = InfiniteData<Paged<PostItem>>;
type PostCache = { post: PostItem; can_reply: boolean };

/**
 * Run `fn` over every cached post: the feeds, the threads, the profiles' Posts
 * lists and the post pages. `fn` gets each top-level item and returns it, a
 * changed copy, or null to take it out of that list. A post page's own post is
 * never removed here (the page says why it's gone instead).
 */
function mapEveryPost(client: ReturnType<typeof useQueryClient>, fn: (item: PostItem) => PostItem | null) {
  const mapList = (data: ListCache | undefined): ListCache | undefined => {
    if (!data?.pages) return data;
    let changed = false;
    const pages = data.pages.map((page) => {
      if (!page?.items) return page;
      const items: PostItem[] = [];
      for (const item of page.items) {
        const next = fn(item);
        if (next !== item) changed = true;
        if (next) items.push(next);
      }
      return { ...page, items };
    });
    return changed ? { ...data, pages } : data;
  };
  for (const prefix of [FEEDS, THREADS, BY_USER]) {
    client.setQueriesData<ListCache>({ queryKey: prefix }, mapList);
  }
  client.setQueriesData<PostCache>({ queryKey: POSTS }, (data) => {
    if (!data?.post) return data;
    const next = fn(data.post);
    return next && next !== data.post ? { ...data, post: next } : data;
  });
}

/** Lay a reaction over every cached copy of the post, as a post or as a reply
 *  inside a post's `top_replies`. */
function patchEverywhere(client: ReturnType<typeof useQueryClient>, result: ReactionResult) {
  mapEveryPost(client, (item) => withReaction(item, result));
}

/**
 * Take a post or reply out of everything this student has loaded: after they
 * delete it, or report it (the API leaves out what you reported from then on,
 * spec §7). A reply also leaves its post's preview, and the post counts one
 * fewer reply.
 */
export function removePostEverywhere(client: ReturnType<typeof useQueryClient>, target: PostItem) {
  const parentId = target.parent_post_id;
  mapEveryPost(client, (item) => {
    if (item.id === target.id) return null;
    const inPreview = item.top_replies?.some((r) => r.id === target.id);
    if (item.id === parentId || inPreview) {
      return {
        ...item,
        replies_count: item.id === parentId ? Math.max(0, (item.replies_count ?? 0) - 1) : item.replies_count,
        top_replies: inPreview ? item.top_replies.filter((r) => r.id !== target.id) : item.top_replies,
      };
    }
    return item;
  });
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

/* ───────────────────────────── Posting ───────────────────────────── */

/** What the compose screen sends (backend/API.md, POST /api/posts). */
export type NewPost = {
  content: string;
  /** Ignored by the server for a reply. */
  scope: 'campus' | 'country' | 'global';
  parentId: string | null;
  gif: GifRef | null;
  photos: { uri: string; name: string; type: string }[];
  /** Re-sending after a nudge (`Post anyway`). */
  confirm: boolean;
};

/** 201: `{ post }`. 202: `{ post, held: true, support }`. */
export type CreatePostAnswer = { post: PostItem; held?: boolean; support?: boolean };

/**
 * The compose screen tells the Community screen what happened after it closes,
 * so the feed can go to its top for a new post, or show the "being checked"
 * toast (spec §2.3), on the screen the student is looking at.
 */
export type ComposeResult = { kind: 'posted'; post: PostItem } | { kind: 'held' };
const composeListeners = new Set<(result: ComposeResult) => void>();
export function onComposeResult(listener: (result: ComposeResult) => void) {
  composeListeners.add(listener);
  return () => {
    composeListeners.delete(listener);
  };
}
export function emitComposeResult(result: ComposeResult) {
  composeListeners.forEach((l) => l(result));
}

/** A new top-level post goes to the top of its own feed, in every sort that is
 *  cached (a feed is always newest first on New; on Hot a new post starts
 *  high, and the student expects to see what they just posted). */
function insertNewPost(client: ReturnType<typeof useQueryClient>, post: PostItem) {
  const prefix: QueryKey =
    post.scope === 'campus'
      ? [...FEEDS, 'campus']
      : post.scope === 'country'
        ? [...FEEDS, 'country', post.country_code]
        : [...FEEDS, 'global'];
  client.setQueriesData<FeedCache>({ queryKey: prefix }, (data) => {
    if (!data?.pages?.length) return data;
    if (data.pages.some((p) => p?.items?.some((i) => i.id === post.id))) return data;
    const [first, ...rest] = data.pages;
    return { ...data, pages: [{ ...first, items: [post, ...(first?.items ?? [])] }, ...rest] };
  });
}

/** A new reply joins its post's preview in every feed (after the top replies,
 *  as on the website: "the preview, plus anything you just replied"), counts
 *  one more reply, and goes at the end of any thread already loaded. */
function insertNewReply(client: ReturnType<typeof useQueryClient>, reply: PostItem) {
  const parentId = reply.parent_post_id;
  if (!parentId) return;
  mapEveryPost(client, (item) =>
    item.id === parentId
      ? {
          ...item,
          replies_count: (item.replies_count ?? 0) + 1,
          top_replies: distinctById([...(item.top_replies ?? []), reply]),
        }
      : item,
  );
  // The feed's thread and the post page's thread (both start with this key).
  client.setQueriesData<ThreadCache>({ queryKey: [...THREADS, parentId] }, (data) => {
    if (!data?.pages?.length) return data;
    const pages = [...data.pages];
    const last = pages[pages.length - 1];
    pages[pages.length - 1] = { ...last, items: distinctById([...(last?.items ?? []), reply]) };
    return { ...data, pages };
  });
}

/**
 * `POST /api/posts`, multipart: content, scope or parent_post_id, gif as a JSON
 * string, images[], and confirm=true after a nudge. Resolves with the answer
 * for 201 and 202; rejects with the ApiError for everything else (its `status`
 * and `body.error` say which), or a plain error when no answer came back.
 *
 * A 201 is put straight into the caches. A 202 (held) is not: only its author
 * can see it, on their Posts tab (part 3).
 */
export function useCreatePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPost) => {
      const form = new FormData();
      form.append('content', input.content);
      if (input.parentId) form.append('parent_post_id', input.parentId);
      else form.append('scope', input.scope);
      if (input.gif) form.append('gif', JSON.stringify(input.gif));
      for (const photo of input.photos) form.append('images', toUploadFile(photo));
      if (input.confirm) form.append('confirm', 'true');
      return api.uploadForm<CreatePostAnswer>('/api/posts', form);
    },
    onSuccess: (answer) => {
      if (!answer?.post || answer.held) return;
      if (answer.post.parent_post_id) insertNewReply(client, answer.post);
      else insertNewPost(client, answer.post);
    },
  });
}

/* ───────────────────────────── A post's page ───────────────────────────── */

/** What a direct link can answer instead of the post (spec §3.1, runbook §1.7). */
export type PostGone = 'POST_NOT_FOUND' | 'POST_DELETED' | 'POST_REMOVED' | 'POST_UNDER_REVIEW';

export function goneCode(err: unknown): PostGone | null {
  const e = err as ApiError | null;
  if (!e?.fromApi) return null;
  const code = e.body?.error;
  if (code === 'POST_DELETED' || code === 'POST_REMOVED' || code === 'POST_UNDER_REVIEW') return code;
  // 404, and a link whose id isn't even a uuid (400).
  if (e.status === 404 || e.status === 400) return 'POST_NOT_FOUND';
  return null;
}

/** `GET /api/posts/:id` → `{ post, can_reply }`. A gone post isn't retried. */
export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: [...POSTS, postId],
    queryFn: () => api.get<PostCache>(`/api/posts/${encodeURIComponent(postId ?? '')}`),
    enabled: !!postId,
    retry: (count, err) => !goneCode(err) && count < 2,
  });
}

/** The post page's replies (spec §4): every reply, in the API's order, a page
 *  of POST_PAGE_REPLIES at a time behind "Load more replies". */
export const POST_PAGE_REPLIES = 20;
export function usePostPageReplies(postId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...THREADS, postId, 'page'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paged<PostItem>>(
        `/api/posts/${encodeURIComponent(postId ?? '')}/replies${query({ limit: POST_PAGE_REPLIES, cursor: pageParam })}`,
      ),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    enabled: enabled && !!postId,
  });
}

/* ───────────────────────────── Profiles' Posts ───────────────────────────── */

/** `GET /api/posts/by-user/:userId`: that person's posts you may see, newest
 *  first, all scopes mixed (a profile isn't a feed). Your own include your
 *  held and covered ones, with their labels (spec §10). */
export function useUserPosts(userId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...BY_USER, userId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paged<PostItem>>(
        `/api/posts/by-user/${encodeURIComponent(userId ?? '')}${query({ limit: FEED_PAGE_SIZE, cursor: pageParam })}`,
      ),
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((p) => p?.items ?? []),
    enabled: enabled && !!userId,
  });
}

/* ───────────────────────────── Delete and report ───────────────────────────── */

/** `DELETE /api/posts/:id`. A 404 means it's already gone, which is what was
 *  asked for. Either way it leaves every list at once (runbook §1.8). */
export function useDeletePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (post: PostItem) => {
      try {
        await api.del(`/api/posts/${encodeURIComponent(post.id)}`);
      } catch (err) {
        if ((err as ApiError)?.status !== 404) throw err;
      }
      return post;
    },
    onSuccess: (post) => removePostEverywhere(client, post),
  });
}

/** `POST /api/reports`. The answer never says what the report caused (spec
 *  §7). Sent: the post leaves this student's lists, and stays gone. */
export function useReportPost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ post, reason, details }: { post: PostItem; reason: string; details: string }) =>
      api.post<{ reported: true }>('/api/reports', {
        target_type: 'post',
        target_id: post.id,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      }),
    onSuccess: (_answer, { post }) => removePostEverywhere(client, post),
  });
}

/* ───────────────────────────── New posts (spec §8) ───────────────────────────── */

/**
 * How many campus posts are newer than `since`, asked every NEW_POSTS_POLL_MS
 * while `enabled` (the campus feed on screen, the app in the foreground). A
 * new `since` is a new key, so it asks again at once.
 */
export function useNewCampusCount(since: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['community', 'new-count', since],
    queryFn: () => api.get<{ count: number }>(`/api/posts/feed/campus/new-count${query({ since })}`),
    enabled: enabled && !!since,
    refetchInterval: enabled ? NEW_POSTS_POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: NEW_POSTS_POLL_MS * 2,
    retry: false,
    select: (d) => d?.count ?? 0,
  });
}

/**
 * The pill's tap (spec §8): fetch the campus feed's first page and put the
 * posts not already shown at the top. Nothing shown is cleared, every page
 * below stays, and posts already there take their fresh copy in place.
 * Resolves false when it couldn't load.
 */
export function useShowNewCampusPosts() {
  const client = useQueryClient();
  return useCallback(async () => {
    let page: FeedPage;
    try {
      page = await api.get<FeedPage>(`/api/posts/feed/campus${query({ limit: FEED_PAGE_SIZE })}`);
    } catch {
      return false;
    }
    client.setQueryData<FeedCache>([...FEEDS, 'campus'], (data) => {
      if (!data?.pages?.length) return data;
      const fresh = new Map(page.items.map((p) => [p.id, p]));
      const known = new Set(data.pages.flatMap((p) => p.items.map((i) => i.id)));
      const added = page.items.filter((p) => !known.has(p.id));
      const pages = data.pages.map((p, i) => ({
        ...p,
        items: [
          ...(i === 0 ? added : []),
          ...p.items.map((item) => (fresh.has(item.id) ? fresh.get(item.id)! : item)),
        ],
      }));
      return { ...data, pages };
    });
    return true;
  }, [client]);
}
