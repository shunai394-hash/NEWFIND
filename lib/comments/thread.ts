export type CommentLike = {
  id: string;
  parentCommentId: string | null;
};

export type ThreadedComment<T extends CommentLike> = T & {
  replies: ThreadedComment<T>[];
};

export function threadComments<T extends CommentLike>(
  comments: T[],
): ThreadedComment<T>[] {
  const nodes = new Map<string, ThreadedComment<T>>();
  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  const roots: ThreadedComment<T>[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id);
    if (!node) continue;
    const parentId = comment.parentCommentId;
    if (parentId && nodes.has(parentId) && parentId !== comment.id) {
      nodes.get(parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function parentAuthorUsername(
  comments: Array<{ id: string; author: { username: string } }>,
  parentCommentId: string | null,
): string | null {
  if (!parentCommentId) return null;
  return (
    comments.find((item) => item.id === parentCommentId)?.author.username ?? null
  );
}
