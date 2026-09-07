import type { PostView } from "@/lib/types";

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 0.5;
  return (value - min) / (max - min);
}

function freshnessScore(view: PostView, now: number) {
  const created = Date.parse(view.createdAt);
  if (!Number.isFinite(created)) return 0;

  const ageHours = Math.max(0, (now - created) / (1000 * 60 * 60));

  // Fresh posts are favored, but older posts can still surface.
  return Math.exp(-ageHours / 72);
}

export function engagementScore(view: PostView) {
  return (
    view.likeCount * 8 +
    view.wantCount * 12 +
    view.saveCount * 6 +
    view.commentCount * 4 +
    view.shareCount * 8
  );
}

function forYouScore(view: PostView, now: number, engagementMin: number, engagementMax: number) {
  const freshness = freshnessScore(view, now);
  const engagement = normalize(
    engagementScore(view),
    engagementMin,
    engagementMax,
  );
  const trend = Math.max(0, Math.min(100, view.trendScore)) / 100;
  const confidence = Math.max(0, Math.min(100, view.confidenceScore)) / 100;

  return (
    freshness * 0.4 +
    engagement * 0.25 +
    trend * 0.25 +
    confidence * 0.1
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
  if (views.length <= 1) return views;

  const now = Date.now();
  const engagementScores = views.map(engagementScore);
  const engagementMin = Math.min(...engagementScores);
  const engagementMax = Math.max(...engagementScores);

  const scored = [...views].sort(
    (a, b) =>
      forYouScore(b, now, engagementMin, engagementMax) -
      forYouScore(a, now, engagementMin, engagementMax),
  );

  return diversifyByOrigin(diversifyByAuthor(scored, 1), 2);
}
