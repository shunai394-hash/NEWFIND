import { curateWorldHeadlines, isPresentableWorldHeadline } from "../lib/ai/control-tower/world-headline-quality";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  const good = {
    actor: "Isla",
    beat: "fashion",
    kind: "NEWS",
    dispatch: "DISCOVERY",
    title: "A new independent label is rethinking recycled nylon outerwear",
    sourceUrl: "https://www.example.org/research/independent-nylon",
    sourceTitle: "Independent nylon research",
  };

  assert(isPresentableWorldHeadline(good), "specific headline with an attributable HTTPS source should pass");
  assert(
    !isPresentableWorldHeadline({ ...good, sourceUrl: null }),
    "unsourced claims must not be presented as reported discoveries",
  );
  assert(
    !isPresentableWorldHeadline({ ...good, sourceUrl: "http://example.org/story" }),
    "public source links must use HTTPS",
  );
  assert(
    !isPresentableWorldHeadline({ ...good, sourceUrl: "https://localhost/private" }),
    "local and non-public source hosts must be rejected",
  );
  assert(
    !isPresentableWorldHeadline({ ...good, sourceUrl: "https://user:pass@example.org/story" }),
    "source URLs containing credentials must be rejected",
  );
  assert(
    !isPresentableWorldHeadline({ ...good, title: "Trend signal 2000+ mixed unrelated headlines" }),
    "synthetic trend-signal aggregates must not appear as discoveries",
  );
  assert(
    !isPresentableWorldHeadline({ ...good, dispatch: "EXPIRED" }),
    "expired investigations must not appear as current discoveries",
  );
  assert(
    !isPresentableWorldHeadline({
      ...good,
      title: "A global report: Trend signal 2000+ mixed unrelated headlines",
    }),
    "synthetic trend-signal aggregates must be rejected even when buried in plausible prose",
  );
  assert(
    !isPresentableWorldHeadline({
      ...good,
      title: "Trend signal 2000+ \\u5fae\\u85fbPHA\\u96f6\\u5e9f\\u5f03\\u98df\\u54c1\\u6258\\u76d8\\u5e02\\u573a\\u5c55\\u671b\\u81f32035: \\u6d77\\u6d0b\\u53ef\\u751f\\u7269\\u964d\\u89e3\\u9700\\u6c42\\u9a71\\u52a8\\u6269\\u5f20 - \\u65b0\\u95fb\\u548c\\u7edf\\u8ba1, \\u5851\\u6599\\u4fbf\\u643a\\u7f50\\u5e02\\u573a\\u5c55\\u671b\\u81f32035\\u5e74: \\u5de5\\u4e1a\\u4e0e\\u519c\\u4e1a\\u9700\\u6c42\\u9a71\\u52a8\\u589e\\u957f - \\u65b0\\u95fb\\u548c\\u7edf\\u8ba1, \\u98df\\u54c1\\u5305\\u88c5\\u9700\\u6c42\\u9a71\\u52a8, \\u5168\\u7403\\u70ed\\u6210\\u578b\\u6258\\u76d8\\u5e02\\u573a\\u9884\\u8ba1\\u589e\\u957f\\u81f32035\\u5e74",
    }),
    "untranslated headline aggregates should be filtered",
  );
  assert(
    isPresentableWorldHeadline({
      ...good,
      title: "日本の食品メーカーが再生素材を使った新包装を発表",
    }),
    "Japanese kanji headlines should remain eligible",
  );
  assert(
    !isPresentableWorldHeadline({ ...good, dispatch: "ARCHIVED" }),
    "archived investigations must not appear as current discoveries",
  );

  const curated = curateWorldHeadlines([
    good,
    { ...good, actor: "Camille", beat: "beauty" },
    { ...good, title: "Trend signal 1000+ unrelated news aggregation" },
    { ...good, title: "A verified product launch from a small Tokyo studio", sourceUrl: "https://tokyo.example.org/launch" },
    { ...good, title: "A promising launch without a source link", sourceUrl: null },
  ]);

  assert(curated.length === 2, "duplicates, unsourced and low-quality headlines should be removed");
  assert(curated[0].actor === "Isla", "first grounded discovery should retain its author");
  assert(
    curated[1].title === "A verified product launch from a small Tokyo studio",
    "distinct grounded discovery should remain",
  );

  console.log("World headline quality tests passed");
}

main();
