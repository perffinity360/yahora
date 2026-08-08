import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { ProductComment, ProductDetailData } from '../types';

/**
 * Q&A mutations for the product detail screen. Both write straight into the
 * `['product', productId]` cache that `useProductDetail` owns.
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

/** Replace one comment inside the cached product, leaving everything else alone. */
function patchComment(
  data: ProductDetailData | undefined,
  commentId: string,
  patch: (comment: ProductComment) => ProductComment,
): ProductDetailData | undefined {
  if (!data?.comments) return data;
  return {
    ...data,
    comments: data.comments.map((c) => (c.id === commentId ? patch(c) : c)),
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
      queryClient.setQueryData<ProductDetailData>(queryKey, (prev) =>
        prev
          ? {
              ...prev,
              comments: [{ ...data.comment, user_vote: 0 }, ...(prev.comments ?? [])],
              comments_count: (prev.comments_count ?? 0) + 1,
            }
          : prev,
      );
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
    onMutate: async (vars): Promise<{ prev: ProductDetailData | undefined }> => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<ProductDetailData>(queryKey);
      queryClient.setQueryData<ProductDetailData>(queryKey, (data) =>
        patchComment(data, vars.commentId, (c) => applyVote(c, vars.voteValue)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(queryKey, ctx.prev);
    },
  });
}
