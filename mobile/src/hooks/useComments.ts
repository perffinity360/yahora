import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { ProductComment } from '../types';
import type { ProductDetailPage } from './useProductDetail';

/**
 * Q&A mutations for the product detail screen. Both write straight into the
 * `['product', productId]` cache that `useProductDetail` owns — an infinite
 * query since Phase 5 V-E, so the cache is `pages` of products, each carrying
 * its own page of comments.
 *
 * Neither invalidates on settle: a refetch of GET /api/products/:id re-runs the
 * `increment_product_views` RPC, so every posted comment or vote would inflate
 * the listing's view count. The cache updates below mirror the server exactly
 * (the same arithmetic the web app runs), so a refetch buys nothing.
 */

/** The POST response carries the stored comment — minus the viewer's own vote,
 *  which is always 0 on a brand-new comment. */
type CreatedComment = Omit<ProductComment, 'user_vote'>;

type AddCommentVars = {
  content: string;
  /** Set to reply to an existing comment; omitted for a top-level question. */
  parentCommentId?: string | null;
};

type VoteVars = {
  commentId: string;
  voteValue: 1 | -1;
};

type DetailCache = InfiniteData<ProductDetailPage>;

/** Replace one comment wherever it is — on any loaded page — leaving everything
 *  else alone. */
function patchComment(
  data: DetailCache | undefined,
  commentId: string,
  patch: (comment: ProductComment) => ProductComment,
): DetailCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.comments?.some((c) => c.id === commentId)
        ? { ...page, comments: page.comments.map((c) => (c.id === commentId ? patch(c) : c)) }
        : page,
    ),
  };
}

/**
 * The web app's exact toggle arithmetic (ProductDetail.jsx `handleVote`), which
 * matches what the `toggle_comment_vote` RPC does server-side:
 *  - voting the same way again clears the vote and drops that counter;
 *  - voting the other way moves the count from one counter to the other.
 */
function applyVote(comment: ProductComment, voteValue: 1 | -1): ProductComment {
  let upvotes = comment.upvotes;
  let downvotes = comment.downvotes;
  let userVote: ProductComment['user_vote'] = voteValue;

  if (comment.user_vote === voteValue) {
    userVote = 0;
    if (voteValue === 1) upvotes -= 1;
    else downvotes -= 1;
  } else if (voteValue === 1) {
    upvotes += 1;
    if (comment.user_vote === -1) downvotes -= 1;
  } else {
    downvotes += 1;
    if (comment.user_vote === 1) upvotes -= 1;
  }

  return { ...comment, upvotes, downvotes, user_vote: userVote };
}

/**
 * Posts a question or a reply. The comment is added to the cache on success —
 * the server assigns the id and timestamp, and only a real id can be voted on.
 * A reply carries `parent_comment_id`, so the same prepend lands it under its
 * parent in the rendered tree.
 */
export function useAddComment(productId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const queryKey = ['product', productId];

  return useMutation({
    mutationFn: (vars: AddCommentVars) => {
      if (!profile?.id) return Promise.reject(new Error('Please sign in to ask a question.'));
      return api.post<{ message: string; comment: CreatedComment }>(
        `/api/products/${productId}/comments`,
        {
          user_id: profile.id,
          content: vars.content,
          parent_comment_id: vars.parentCommentId ?? null,
        },
      );
    },
    onSuccess: (data) => {
      // Onto the NEWEST page, which is where a brand-new comment belongs and
      // whose product fields the screen reads. A reply lands there too and
      // still renders under its parent, whichever page the parent came from:
      // threading matches on parent_comment_id across the joined list.
      queryClient.setQueryData<DetailCache>(queryKey, (prev) => {
        if (!prev?.pages.length) return prev;
        const [first, ...rest] = prev.pages;
        return {
          ...prev,
          pages: [
            {
              ...first,
              comments: [{ ...data.comment, user_vote: 0 }, ...(first.comments ?? [])],
              comments_count: (first.comments_count ?? 0) + 1,
            },
            ...rest,
          ],
        };
      });
    },
  });
}

/**
 * Up/down vote on a comment, applied optimistically so the pill reacts on the
 * tap and rolled back if the request fails.
 */
export function useVoteComment(productId: string | undefined) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const queryKey = ['product', productId];

  return useMutation({
    mutationFn: (vars: VoteVars) => {
      if (!profile?.id) return Promise.reject(new Error('Please sign in to vote.'));
      return api.post(`/api/products/comments/${vars.commentId}/vote`, {
        user_id: profile.id,
        vote_value: vars.voteValue,
      });
    },
    onMutate: async (vars): Promise<{ prev: DetailCache | undefined }> => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<DetailCache>(queryKey);
      queryClient.setQueryData<DetailCache>(queryKey, (data) =>
        patchComment(data, vars.commentId, (c) => applyVote(c, vars.voteValue)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(queryKey, ctx.prev);
    },
  });
}
