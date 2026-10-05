import { parseFutureTechFeed } from "../lib/ai/world-sources/future-tech-news";

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

console.log("Future-tech feed parser tests passed");
