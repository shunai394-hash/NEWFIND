import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const outDir = path.join(process.cwd(), "scripts", "smoke-output");
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const consoleErrors = [];
const pageErrors = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function attachListeners(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ label, text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ label, text: err.message });
  });
}

async function waitReady(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes("読み込み中..."),
    { timeout: 15000 },
  );
}

async function brokenImages(page) {
  return page.$$eval("img", (imgs) =>
    imgs
      .filter((img) => !img.naturalWidth)
      .map((img) => img.getAttribute("src") || ""),
  );
}

async function firstPostId(page) {
  const href = await page.locator('a[href^="/p/"]').first().getAttribute("href");
  return href ? href.replace("/p/", "") : null;
}

const pngPath = path.join(outDir, "tiny.png");
fs.writeFileSync(
  pngPath,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const email = `smoke.${Date.now()}@example.com`;
const password = "password123";
let createdPostId = null;
let profileUsername = null;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "ja-JP",
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
attachListeners(page, "mobile");

try {
  // 1. Home For You
  await page.goto(BASE, { waitUntil: "networkidle" });
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "01-home.png"), fullPage: true });
  const homeText = await page.locator("body").innerText();
  record("1. For You tab visible", homeText.includes("For You"));
  const articleCount = await page.locator("article").count();
  record("1. Posts render", articleCount > 0, `${articleCount} articles`);
  const brokenHome = await brokenImages(page);
  record("1. Home images", brokenHome.length === 0, brokenHome.join(", "));

  // Guest like redirects to login
  await page.getByRole("button", { name: "Like" }).first().click();
  await page.waitForURL(/\/login/, { timeout: 8000 });
  record("1. Guest Like → login", page.url().includes("/login"));
  await page.goto(BASE);
  await waitReady(page);

  // Share works as guest
  await page.getByRole("button", { name: "Share" }).first().click();
  await page.getByRole("button", { name: "リンクをコピー" }).click();
  await page.waitForTimeout(300);
  const copied =
    (await page.getByText("リンクをコピーしました").count()) +
    (await page.locator('input[readonly]').count());
  record("1. Guest Share copy", copied > 0);
  await page.getByRole("button", { name: "キャンセル" }).click();

  // 7. Login / signup
  await page.goto(`${BASE}/login`);
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "07-login.png") });
  record("7. Login page", (await page.locator("body").innerText()).includes("NEWFIND"));
  record(
    "7. Google button",
    (await page.getByRole("button", { name: "Googleで続ける" }).count()) === 1,
  );
  record(
    "7. Apple button",
    (await page.getByRole("button", { name: "Appleで続ける" }).count()) === 1,
  );

  await page.getByRole("button", { name: "Googleで続ける" }).click();
  await page.waitForTimeout(400);
  const oauthMsg = await page.locator("body").innerText();
  record(
    "7. Google/Apple local mode message",
    oauthMsg.includes("Supabase"),
    oauthMsg.includes("Supabase") ? "local mode (expected)" : "no message",
  );

  await page.getByRole("button", { name: "登録する" }).last().click();
  await page.getByPlaceholder("表示名").fill("Smoke Tester");
  await page.getByPlaceholder("メールアドレス").fill(email);
  await page.getByPlaceholder("パスワード").fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  record("7. Email signup", !page.url().includes("/login"), page.url());

  await page.goto(BASE);
  await waitReady(page);

  const likeBefore = await page.getByRole("button", { name: "Like" }).first().innerText();
  await page.getByRole("button", { name: "Like" }).first().click();
  await page.waitForTimeout(300);
  const likeAfter = await page.getByRole("button", { name: "Like" }).first().innerText();
  record("1. Like toggles", likeBefore !== likeAfter, `${likeBefore} → ${likeAfter}`);

  const wantBefore = await page.getByRole("button", { name: "Want" }).first().innerText();
  await page.getByRole("button", { name: "Want" }).first().click();
  await page.waitForTimeout(300);
  const wantAfter = await page.getByRole("button", { name: "Want" }).first().innerText();
  record("1. Want toggles", wantBefore !== wantAfter, `${wantBefore} → ${wantAfter}`);

  await page.getByRole("button", { name: "Save" }).first().click();
  await page.waitForTimeout(300);
  record("1. Save click", true);

  // 2. Follow then Following
  const followBtn = page.getByRole("button", { name: /^フォロー$/ }).first();
  if ((await followBtn.count()) > 0) {
    await followBtn.click();
    await page.waitForTimeout(400);
    record("2. Follow from feed", true);
  } else {
    record("2. Follow from feed", false, "no follow button");
  }

  await page.goto(`${BASE}/following`);
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "02-following.png") });
  const followingText = await page.locator("body").innerText();
  record("2. Following screen", followingText.includes("Following"));
  const followingPosts = await page.locator("article").count();
  record("2. Following posts", followingPosts > 0, `${followingPosts} articles`);

  // 3. Discover
  await page.goto(`${BASE}/discover`);
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "03-discover.png") });
  const discoverText = await page.locator("body").innerText();
  record(
    "3. Discover tabs",
    ["Search", "Trending", "New Finds", "Category"].every((t) => discoverText.includes(t)),
  );

  await page.getByRole("button", { name: "Search" }).click();
  await page.getByPlaceholder("アカウントや投稿を検索").fill("mei");
  await page.waitForTimeout(500);
  const searchText = await page.locator("body").innerText();
  record("3. Search", searchText.includes("mei_finds") || searchText.includes("アカウント"));

  await page.getByRole("button", { name: "Trending" }).click();
  await page.waitForTimeout(400);
  record("3. Trending grid", (await page.locator('a[href^="/p/"]').count()) > 0);

  await page.getByRole("button", { name: "New Finds" }).click();
  await page.waitForTimeout(400);
  record("3. New Finds grid", (await page.locator('a[href^="/p/"]').count()) > 0);

  await page.getByRole("button", { name: "Category" }).click();
  await page.getByRole("button", { name: "ファッション" }).click();
  await page.waitForTimeout(400);
  record("3. Category", (await page.locator("body").innerText()).includes("Category"));

  const postId = await firstPostId(page);

  // 4. Create photo
  await page.goto(`${BASE}/create`);
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "04-create.png") });
  await page.locator('input[type="file"]').setInputFiles(pngPath);
  await page.getByPlaceholder("キャプション").fill("スモークテストの写真投稿");
  await page.getByPlaceholder("商品リンク（任意・外部EC / 公式サイト）").fill("https://www.muji.com/");
  await page.getByRole("button", { name: "シェア" }).click();
  await page.waitForURL(/\/p\//, { timeout: 15000 });
  await page.waitForSelector("article", { timeout: 15000 });
  createdPostId = page.url().split("/p/")[1]?.split("?")[0];
  record("4. Photo post", Boolean(createdPostId), createdPostId || "");
  const createdText = await page.locator("article").innerText();
  record("4. Caption saved", createdText.includes("スモークテストの写真投稿"));
  record("4. Product URL CTA", createdText.includes("商品を見る"));
  const ctaColor = await page.locator("a", { hasText: "商品を見る" }).first().evaluate((el) => getComputedStyle(el).color);
  record("9. CTA text is white", ctaColor === "rgb(255, 255, 255)", ctaColor);

  // 4b. Video via URL
  await page.goto(`${BASE}/create`);
  await waitReady(page);
  await page
    .getByPlaceholder("またはメディアURL")
    .fill("https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4");
  await page.getByPlaceholder("キャプション").fill("スモークテストの動画投稿");
  await page.getByPlaceholder("商品リンク（任意・外部EC / 公式サイト）").fill("https://www.nike.com/");
  await page.getByRole("button", { name: "シェア" }).click();
  await page.waitForURL(/\/p\//, { timeout: 15000 });
  await page.waitForSelector("article", { timeout: 15000 });
  const videoOk = (await page.locator("video").count()) > 0;
  record("4. Video post", videoOk, page.url());

  // 5. Post detail
  const detailId = postId || createdPostId;
  await page.goto(`${BASE}/p/${detailId}`);
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "05-post.png") });
  record("5. Post detail", (await page.locator("article").count()) > 0);
  await page.getByRole("button", { name: "Comment" }).first().click();
  await page.getByPlaceholder("コメントを追加...").fill("動作確認コメント");
  await page.getByRole("button", { name: "投稿" }).click();
  await page.waitForTimeout(400);
  record(
    "5. Comment",
    (await page.locator("body").innerText()).includes("動作確認コメント"),
  );
  await page.getByRole("button", { name: "閉じる" }).click();

  const cta = page.locator("a", { hasText: "商品を見る" }).first();
  if ((await cta.count()) > 0) {
    const href = await cta.getAttribute("href");
    const target = await cta.getAttribute("target");
    record(
      "5/9. 商品を見る href",
      Boolean(href && href.startsWith("http") && target === "_blank"),
      href || "",
    );
  } else {
    record("5/9. 商品を見る href", false, "CTA missing");
  }

  // 6. Profile
  await page.goto(`${BASE}/u/mei_finds`);
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "06-profile.png") });
  const profileText = await page.locator("body").innerText();
  record("6. Profile", profileText.includes("mei_finds") || profileText.includes("Mei"));
  record("6. Profile posts", (await page.locator('a[href^="/p/"]').count()) > 0);
  const profileFollow = page.getByRole("button", { name: /フォロー/ }).first();
  if ((await profileFollow.count()) > 0) {
    await profileFollow.click();
    await page.waitForTimeout(300);
    record("6. Follow on profile", true);
  } else {
    record("6. Follow on profile", false, "button missing");
  }

  // 8. Settings
  await page.goto(`${BASE}/settings`);
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "08-settings.png") });
  record("8. Settings", (await page.locator("body").innerText()).includes("プロフィール"));
  await page.getByLabel("表示名").fill("Smoke Edited");
  await page.getByRole("checkbox", { name: "ビジネスアカウント" }).check();
  await page.getByLabel("会社名").fill("Smoke Inc");
  await page.getByLabel("Webサイト").fill("https://www.brandbridge.jp");
  await page.getByRole("button", { name: "保存" }).click();
  await page.waitForURL(/\/u\//, { timeout: 10000 });
  await page.waitForSelector("article, .bg-white", { timeout: 15000 });
  await page.waitForTimeout(500);
  profileUsername = decodeURIComponent(page.url().split("/u/")[1] || "");
  await page.screenshot({ path: path.join(outDir, "08b-profile-after-save.png") });
  const afterSave = await page.locator("body").innerText();
  record(
    "8. Profile edit + Business",
    afterSave.includes("Smoke Edited") && afterSave.includes("ビジネス"),
    `${profileUsername} :: ${afterSave.replace(/\s+/g, " ").slice(0, 180)}`,
  );

  await page.goto(`${BASE}/settings`);
  await waitReady(page);
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/login`);
  await waitReady(page);
  await page.getByPlaceholder("メールアドレス").fill(email);
  await page.getByPlaceholder("パスワード").fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  record("7. Email login", !page.url().includes("/login"), page.url());

  // 404
  const res404 = await page.goto(`${BASE}/this-page-does-not-exist`);
  record("404 status", (res404?.status() ?? 0) === 404, String(res404?.status()));

  // Desktop viewport
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE);
  await waitReady(page);
  await page.screenshot({ path: path.join(outDir, "09-desktop.png"), fullPage: true });
  const desktopWidth = await page.locator(".max-w-\\[430px\\]").first().evaluate((el) => el.clientWidth);
  record("Desktop phone frame", desktopWidth <= 430, `width=${desktopWidth}`);
  const brokenDesktop = await brokenImages(page);
  record("Desktop images", brokenDesktop.length === 0, brokenDesktop.join(", "));
} catch (err) {
  record("RUNNER", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const failCount = results.filter((r) => !r.ok).length;
const report = {
  failCount,
  results,
  consoleErrors,
  pageErrors,
};
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("\n--- console errors ---");
console.log(consoleErrors.length ? consoleErrors : "none");
console.log("\n--- page errors ---");
console.log(pageErrors.length ? pageErrors : "none");
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exit(failCount ? 1 : 0);
