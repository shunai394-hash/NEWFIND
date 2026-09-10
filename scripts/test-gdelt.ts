import fs from "node:fs";
import { fetchGdeltArticles, getSharedWorldNews } from "../lib/ai/gdelt";

const envPath = ".env.local";

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function printArticle(article: {
  title: string;
  url: string;
  domain: string;
  language: string | null;
  sourceCountry: string | null;
  imageUrl: string | null;
  publishedAt?: string | null;
}) {
  console.log({
    title: article.title,
    url: article.url,
    domain: article.domain,
    language: article.language,
    sourceCountry: article.sourceCountry,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt ?? null,
  });
}

async function main() {
  console.log("===== SHARED WORLD NEWS (one GDELT fetch) =====");
  const shared = await getSharedWorldNews();
  console.log("shared count:", shared.length);
  console.log(
    "roles:",
    [...new Set(shared.map((item) => item.sourceRole))].join(", ") || "(none)",
  );
  for (const article of shared.slice(0, 8)) {
    printArticle(article);
  }

  if (shared.length === 0) {
    console.log("===== GDELT DIRECT FETCH FALLBACK =====");
    const articles = await fetchGdeltArticles();
    console.log("count:", articles.length);
    for (const article of articles.slice(0, 8)) {
      printArticle(article);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
