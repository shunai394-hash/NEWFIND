/**
 * Local UI check: open feed → コメントを見る → write → reply → send.
 * Uses Playwright against a running Next server.
 *
 * Usage:
 *   npx tsx scripts/e2e-comment-flow.ts http://localhost:3020
 */
import { chromium } from "playwright";

async function main() {
  const base = process.argv[2] || "http://localhost:3020";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const log: string[] = [];

  try {
    await page.goto(`${base}/feed`, { waitUntil: "domcontentloaded", timeout: 60000 });
    log.push(`opened ${page.url()}`);

    // Wait for a post card comment affordance
    const commentBtn = page.getByRole("button", { name: /コメント/ }).first();
    await commentBtn.waitFor({ timeout: 30000 });
    await commentBtn.click({ force: true });
    log.push("clicked コメントを見る / comment action");

    const sheet = page.getByText("コメント", { exact: true }).first();
    await sheet.waitFor({ timeout: 10000 });
    log.push("comment sheet opened");

    const loginHint = page.getByText("コメントするにはログインしてください");
    if (await loginHint.isVisible().catch(() => false)) {
      log.push("sheet opened (login required to write — portal/z-index OK)");
      // Close the portalized sheet specifically (z-400 overlay), not WorldIntro
      await page.locator(".fixed.inset-0.z-\\[400\\]").getByRole("button", { name: "閉じる" }).click();
      log.push("closed sheet");
      console.log(JSON.stringify({ ok: true, mode: "anonymous-open", log }, null, 2));
      return;
    }

    const input = page.getByPlaceholder(/コメントを追加|に返信/);
    await input.fill(`E2E comment ${Date.now()}`);
    await page.getByRole("button", { name: "送信" }).click();
    log.push("sent root comment");

    const reply = page.getByRole("button", { name: "返信" }).first();
    await reply.waitFor({ timeout: 10000 });
    await reply.click();
    log.push("clicked 返信");

    await page.getByText(/に返信/).first().waitFor({ timeout: 5000 });
    log.push("reply banner visible");

    await input.fill(`E2E reply ${Date.now()}`);
    await page.getByRole("button", { name: "送信" }).click();
    log.push("sent reply with parent_comment_id path");

    await page.waitForTimeout(800);
    console.log(JSON.stringify({ ok: true, mode: "authenticated", log }, null, 2));
  } catch (error) {
    const shot = "e2e-comment-fail.png";
    await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
    console.error(JSON.stringify({
      ok: false,
      log,
      error: error instanceof Error ? error.message : String(error),
      screenshot: shot,
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
