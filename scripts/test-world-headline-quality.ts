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
