import { diversifyFutureTechItems, parseFutureTechFeed } from "../lib/ai/world-sources/future-tech-news";
import { ARXIV_FUTURE_TECH_QUERY_GROUPS } from "../lib/ai/world-sources/arxiv";
import { evaluateCaptionQuality } from "../lib/ai/post-quality";
import { worldSourceCollectors } from "../lib/ai/world-sources";
import { canonicalizeSourceUrl } from "../lib/ai/agent-os/hash";
import { dedupeWorldSourceItems, type WorldSourceItem } from "../lib/ai/world-sources/types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const upperCasePath = canonicalizeSourceUrl("https://EXAMPLE.org/Story/ID?ref=Main&utm_source=rss#comments");
const lowerCasePath = canonicalizeSourceUrl("https://example.org/story/id?ref=Main");
assert(
  upperCasePath === "https://example.org/Story/ID?ref=Main",
  "source URL canonicalization should remove tracking parameters without lowercasing the path or query values",
);
assert(
  upperCasePath !== lowerCasePath,
  "case-sensitive URL paths must not be merged into one source",
);
assert(
  canonicalizeSourceUrl("https://www.example.org/article?id=7&utm_source=rss#section") ===
    "https://example.org/article?id=7",
  "canonicalization should remove www, tracking parameters and fragments while preserving article identifiers",
);

const sourceItem = (
  url: string,
  sourceName: WorldSourceItem["sourceName"],
  sourceRef: string,
): WorldSourceItem => ({
  title: "Case-sensitive source",
  url,
  snippet: "A sourced technology report.",
  sourceType: "news",
  domain: new URL(url).hostname,
  sourceName,
  sourceRef,
  signalType: "technology",
});
const sourceDeduped = dedupeWorldSourceItems([
  sourceItem("https://www.example.org/Story?id=7&utm_source=feed", "future_tech_news", "https://www.example.org/Story?id=7&utm_source=feed"),
  sourceItem("https://example.org/Story?id=7#details", "arxiv", "https://example.org/Story?id=7#details"),
  sourceItem("https://example.org/story?id=7", "arxiv", "https://example.org/story?id=7"),
]);
assert(
  sourceDeduped.length === 2,
  "world-source deduplication should collapse syndicated tracking variants across collectors but preserve case-sensitive distinct URLs",
);

const rss = `<?xml version="1.0"?>
<rss><channel>
  <item><title>Robot learns new manipulation task</title><link>https://robotics.example.org/story?id=7</link><description><![CDATA[A robot learned a new task &amp; reduced setup time.]]></description><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate></item>
  <item><title>Unsafe source</title><link>http://example.org/story</link><description>Must be excluded.</description></item>
  <item><title>Older robot report</title><link>https://robotics.example.org/older</link><description>Earlier published.</description><pubDate>Sun, 04 Oct 2026 10:00:00 GMT</pubDate></item>
  <item><title>Missing description</title><link>https://example.org/no-description</link></item>
</channel></rss>`;

const rssItems = parseFutureTechFeed(rss);
assert(rssItems.length === 2, "RSS parser should keep complete HTTPS items");
assert(rssItems[0].title === "Robot learns new manipulation task", "RSS title should be preserved");
assert(rssItems[0].link === "https://robotics.example.org/story?id=7", "RSS source URL should be preserved");
assert(rssItems[0].description.includes("reduced setup time"), "RSS summary should be decoded");
assert(rssItems[1].title === "Older robot report", "RSS entries should be ordered newest first before batch limits are applied");

const diversified = diversifyFutureTechItems(
  [
    [
      { url: "https://ai.example.org/newest", publishedAt: "2026-10-06T10:00:00Z" },
      { url: "https://ai.example.org/older", publishedAt: "2026-10-05T10:00:00Z" },
      { url: "https://shared.example.org/story?utm_source=ai", publishedAt: "2026-10-04T10:00:00Z" },
    ],
    [
      { url: "https://robot.example.org/newest", publishedAt: "2026-10-06T09:00:00Z" },
      { url: "https://robot.example.org/older", publishedAt: "2026-10-05T09:00:00Z" },
      { url: "https://shared.example.org/story", publishedAt: "2026-10-04T09:00:00Z" },
    ],
  ],
  6,
);
assert(
  diversified.slice(0, 4).map((item) => new URL(item.url).hostname).join(",") ===
    "ai.example.org,robot.example.org,ai.example.org,robot.example.org",
  "future-tech intake should interleave publishers instead of letting one feed dominate",
);
assert(
  new Set(diversified.map((item) => item.url.replace(/[?#].*$/, ""))).size === diversified.length,
  "future-tech intake should deduplicate the same article across feeds",
);
assert(
  diversified.length === 5 &&
    diversified.filter((item) => new URL(item.url).hostname === "shared.example.org").length === 1,
  "the story syndicated by both feeds should be kept exactly once (5 unique items out of 6)",
);
assert(
  diversifyFutureTechItems(
    [
      [{ url: "https://ai.example.org/a" }, { url: "https://ai.example.org/b" }],
      [{ url: "https://robot.example.org/a" }, { url: "https://robot.example.org/b" }],
    ],
    3,
  ).length === 3,
  "future-tech intake should stop at the requested limit",
);
assert(
  diversifyFutureTechItems([[{ url: "https://ai.example.org/a" }]], 0).length === 0,
  "a zero limit should return nothing",
);
const queryIdentified = diversifyFutureTechItems(
  [
    [
      { url: "https://news.example.org/story?id=7" },
      { url: "https://news.example.org/story?id=8" },
    ],
    [{ url: "https://www.news.example.org/story?id=7&utm_source=rss#comments" }],
  ],
  10,
);
assert(
  queryIdentified.map((item) => item.url).join(",") ===
    "https://news.example.org/story?id=7,https://news.example.org/story?id=8",
  "articles identified by a query string must stay distinct, while tracking parameters and www are ignored",
);

const atom = `<feed><entry><title>Research on holographic displays</title><link rel="alternate" type="text/html" href="https://lab.example.org/holography"/><summary>Researchers report a new optical approach.</summary><published>2026-10-05T08:00:00Z</published></entry></feed>`;
const atomItems = parseFutureTechFeed(atom);
assert(atomItems.length === 1, "Atom entries with href links should be parsed");
assert(atomItems[0].link === "https://lab.example.org/holography", "Atom href should be used as source URL");
assert(atomItems[0].publishedAt?.startsWith("2026-10-05"), "Atom publication date should be preserved");

const explainer = [
  "【何が変わる？】新しい光学方式を使うホログラム研究が報告されました。これは研究段階の成果であり、一般向け製品としてすぐ使えることを意味しません。",
  "【活用の可能性】遠隔案内、展示、設計レビューなどで立体的な情報共有に役立つ可能性があります。実用化には表示装置の価格、視野角、明るさ、消費電力などの検証が必要です。",
  "【注意点】提供された要約だけでは量産時期や価格は確認できません。原文を読んで、実験結果と将来の応用を分けて判断したいです。",
  "出典: https://lab.example.org/holography",
].join("\\n");
assert(
  evaluateCaptionQuality({ caption: explainer, subjectLabel: "Research on holographic displays", isEditorial: true }).ok,
  "source-backed editorial explainers should not be rejected for lacking numeric specs",
);
assert(
  !evaluateCaptionQuality({ caption: "A very short research note.", subjectLabel: "research", isEditorial: true }).ok,
  "editorial mode must still reject low-substance short captions",
);

assert(
  worldSourceCollectors.some((collector) => collector.source === "future_tech_news"),
  "future-tech reporting feeds must be wired into the live world intelligence collector",
);
assert(
  ARXIV_FUTURE_TECH_QUERY_GROUPS.some((query) => query.includes("cat:cs.AR")),
  "research intake should cover computer architecture and next-generation PC/chip work",
);
assert(
  ARXIV_FUTURE_TECH_QUERY_GROUPS.some((query) => query.includes("cat:physics.optics") && query.includes("cat:cs.GR")),
  "research intake should cover optical/holographic and spatial-computing work",
);

console.log("Future-tech feed and editorial quality tests passed");
