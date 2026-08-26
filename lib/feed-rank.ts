import type { PostView } from "@/lib/types";

export function engagementScore(view: PostView) {
  return (
    Date.parse(view.createdAt) / 60000 +
    view.likeCount * 8 +
    view.wantCount * 12 +
    view.saveCount * 6 +
    view.commentCount * 4
  );
}

/**
 * Keep high-engagement order, but avoid long runs of the same author
 * so demo / For You feeds feel varied. Does not drop any posts.
 */
export function diversifyByAuthor(views: PostView[], maxStreak = 1): PostView[] {
  if (views.length <= 2) return views;
  const remaining = [...views];
  const out: PostView[] = [];
  let lastAuthor: string | null = null;
  let streak = 0;

  while (remaining.length > 0) {
    let idx = remaining.findIndex((v) => {
      if (v.authorId !== lastAuthor) return true;
      return streak < maxStreak;
    });
    if (idx < 0) idx = 0;
    const next = remaining.splice(idx, 1)[0]!;
    if (next.authorId === lastAuthor) streak += 1;
    else {
      lastAuthor = next.authorId;
      streak = 1;
    }
    out.push(next);
  }
  return out;
}

function demoOrigin(view: PostView) {
  const username = view.author?.username ?? "";
  if (username.startsWith("nfdemo_jp_")) return "jp";
  if (username.startsWith("nfdemo_")) return "os";
  return "user";
}

/** Avoid long runs of Japan-only or overseas-only demo posts on For You. */
export function diversifyByOrigin(views: PostView[], maxStreak = 2): PostView[] {
  if (views.length <= 2) return views;
  const remaining = [...views];
  const out: PostView[] = [];
  let lastOrigin: string | null = null;
  let streak = 0;

  while (remaining.length > 0) {
    let idx = remaining.findIndex((v) => {
      if (demoOrigin(v) !== lastOrigin) return true;
      return streak < maxStreak;
    });
    if (idx < 0) idx = 0;
    const next = remaining.splice(idx, 1)[0]!;
    const origin = demoOrigin(next);
    if (origin === lastOrigin) streak += 1;
    else {
      lastOrigin = origin;
      streak = 1;
    }
    out.push(next);
  }
  return out;
}

export function rankForYouFeed(views: PostView[]): PostView[] {
  const scored = [...views].sort((a, b) => engagementScore(b) - engagementScore(a));
  return diversifyByOrigin(diversifyByAuthor(scored, 1), 2);
}
