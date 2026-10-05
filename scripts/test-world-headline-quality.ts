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
  };

  assert(isPresentableWorldHeadline(good), "specific grounded headline should pass");
  assert(
    !isPresentableWorldHeadline({ ...good, title: "Trend signal 2000+ mixed unrelated headlines" }),
    "synthetic trend-signal aggregates must not appear as discoveries",
  );
  assert(
    !isPresentableWorldHeadline({ ...good, dispatch: "EXPIRED" }),
    "expired investigations must not appear as current discoveries",
  );

  const curated = curateWorldHeadlines([
    good,
    { ...good, actor: "Camille", beat: "beauty" },
    { ...good, title: "Trend signal 1000+ unrelated news aggregation" },
    { ...good, title: "A verified product launch from a small Tokyo studio" },
  ]);

  assert(curated.length === 2, "duplicate and low-quality headlines should be removed");
  assert(curated[0].actor === "Isla", "first grounded discovery should retain its author");
  assert(
    curated[1].title === "A verified product launch from a small Tokyo studio",
    "distinct grounded discovery should remain",
  );

  console.log("World headline quality tests passed");
}

main();
