export interface ForumAuthorReference {
  author_id?: string | null;
  is_anonymous?: boolean;
}

/** Returns only author IDs that are safe to resolve to public profiles. */
export const visibleAuthorIds = (posts: ForumAuthorReference[]): string[] =>
  [...new Set(
    posts
      .filter((post) => !post.is_anonymous && Boolean(post.author_id))
      .map((post) => post.author_id as string),
  )];

export const buildReadReceiptRows = (postIds: string[], userId: string) =>
  [...new Set(postIds)].map((postId) => ({ post_id: postId, user_id: userId }));
