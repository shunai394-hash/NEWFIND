import { parseFutureTechFeed } from "../lib/ai/world-sources/future-tech-news";
import { evaluateCaptionQuality } from "../lib/ai/post-quality";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const rss = `<?xml version="1.0"?>
<rss><channel>
  <item><title>Robot learns new manipulation task</title><link>https://robotics.example.org/story?id=7</link><description><![CDATA[A robot learned a new task &amp; reduced setup time.]]></description><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate></item>
  <item><title>Unsafe source</title><link>http://example.org/story</link><description>Must be excluded.</description></item>
  <item><title>Missing description</title><link>https://example.org/no-description</link></item>
</channel></rss>`;

const rssItems = parseFutureTechFeed(rss);
assert(rssItems.length === 1, "RSS parser should keep only complete HTTPS items");
assert(rssItems[0].title === "Robot learns new manipulation task", "RSS title should be preserved");
assert(rssItems[0].link === "https://robotics.example.org/story?id=7", "RSS source URL should be preserved");
assert(rssItems[0].description.includes("reduced setup time"), "RSS summary should be decoded");

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

console.log("Future-tech feed and editorial quality tests passed");
