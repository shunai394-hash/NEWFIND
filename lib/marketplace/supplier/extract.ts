import type { ObservedFact, PriceBreak } from "../types";
import type { SupplierCandidate } from "./types";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const MOQ_RE =
  /(?:moq|minimum(?:\s+order)?(?:\s+quantity)?|最低(?:発注|注文)(?:数量)?)[^\d]{0,12}(\d{1,6})/i;
const PRICE_RE =
  /(?:wholesale\s*(?:price|pricing)?|trade\s*price|卸(?:価格)?)[^\d$¥€£]{0,8}([$¥€£]\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:usd|jpy|eur|gbp|円))/i;
const RETAIL_RE =
  /(?:msrp|rrp|list price|希望小売|参考(?:小売)?価格)[^\d$¥€£]{0,12}([$¥€£]?\s?\d+(?:[.,]\d+)?)/i;
const SHIP_JP_RE = /ships?\s+to\s+japan|日本(へ|に)?発送|worldwide shipping/i;
const NO_SHIP_JP_RE = /does not ship to japan|日本(へ|に)?発送不可/i;
const SAMPLE_RE = /sample (available|request)|サンプル (可|あり)/i;
const LEAD_RE = /lead time[^\n.]{0,24}|納期[^\n.]{0,16}/i;
const WHOLESALE_RE = /wholesale|trade only|b2b|卸売|業者向け/i;
const APPLY_RE = /apply for (a )?wholesale|卸 (会員|申請|アカウント)/i;

function money(raw: string | null): { amount: number; currency: string } | null {
  if (!raw) return null;
  const currency = raw.includes("¥") || raw.includes("円")
    ? "JPY"
    : raw.includes("€")
      ? "EUR"
      : raw.includes("£")
        ? "GBP"
        : "USD";
  const amount = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currency };
}

export function extractSupplierFactsFromText(input: {
  htmlOrText: string;
  pageUrl: string;
  observedAt: string;
}): {
  patch: Partial<SupplierCandidate>;
  facts: ObservedFact[];
} {
  const text = input.htmlOrText.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
  const facts: ObservedFact[] = [];
  const patch: Partial<SupplierCandidate> = {};
  const moqMatch = text.match(MOQ_RE);
  if (moqMatch) {
    const moq = Number(moqMatch[1]);
    patch.moq = moq;
    patch.minimumOrderQuantity = moq;
    facts.push({
      text: `MOQ ${moq} is stated on the page`,
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  const wholesalePrice = money((text.match(PRICE_RE) ?? [])[1] ?? null);
  if (wholesalePrice) {
    patch.unitPrice = wholesalePrice.amount;
    patch.currency = wholesalePrice.currency;
    patch.wholesaleAvailable = true;
    facts.push({
      text: `Wholesale/trade price ${wholesalePrice.amount} ${wholesalePrice.currency} is stated`,
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  const retail = money((text.match(RETAIL_RE) ?? [])[1] ?? null);
  if (retail) {
    patch.referenceRetailPrice = retail.amount;
    patch.referenceRetailCurrency = retail.currency;
    facts.push({
      text: `Reference retail price ${retail.amount} ${retail.currency} is stated`,
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  if (SHIP_JP_RE.test(text)) {
    patch.shipsToJapan = true;
    facts.push({
      text: "Page states shipping to Japan or worldwide shipping",
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  } else if (NO_SHIP_JP_RE.test(text)) {
    patch.shipsToJapan = false;
    facts.push({
      text: "Page states Japan shipping is not available",
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  if (SAMPLE_RE.test(text)) {
    patch.sampleAvailable = true;
    facts.push({
      text: "Sample availability is stated",
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  const lead = text.match(LEAD_RE)?.[0]?.trim() ?? null;
  if (lead) {
    patch.leadTime = lead.slice(0, 80);
    facts.push({
      text: `Lead time text: ${patch.leadTime}`,
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  if (WHOLESALE_RE.test(text)) {
    patch.wholesaleAvailable = patch.wholesaleAvailable ?? true;
    facts.push({
      text: "Wholesale/B2B language is present",
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  if (APPLY_RE.test(text)) {
    patch.wholesaleApplicationRequired = true;
    facts.push({
      text: "Wholesale application/account is required according to the page",
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  const emails = [...text.matchAll(EMAIL_RE)].map((item) => item[0].toLowerCase());
  const publicEmail = emails.find(
    (email) =>
      /wholesale|sales|trade|info|b2b|contact/.test(email) &&
      !/example\.com|privacy|noreply/.test(email),
  );
  if (publicEmail) {
    patch.contactEmailIfPublic = publicEmail;
    facts.push({
      text: `Public contact email listed: ${publicEmail}`,
      sourceUrl: input.pageUrl,
      sourceName: "supplier_page",
      observedAt: input.observedAt,
    });
  }
  const breaks: PriceBreak[] = [];
  const breakRe =
    /(\d+)\s*\+\s*(?:units?)?[^\d$¥]{0,8}([$¥€£]?\s?\d+(?:\.\d+)?)/gi;
  let match: RegExpExecArray | null = breakRe.exec(text);
  while (match) {
    const parsed = money(match[2]);
    const qty = Number(match[1]);
    if (parsed && qty > 0) {
      breaks.push({
        minQuantity: qty,
        unitPrice: parsed.amount,
        currency: parsed.currency,
      });
    }
    match = breakRe.exec(text);
  }
  if (breaks.length) {
    patch.priceBreaks = breaks.slice(0, 6);
    patch.priceMin = Math.min(...breaks.map((item) => item.unitPrice));
    patch.priceMax = Math.max(...breaks.map((item) => item.unitPrice));
  }
  return { patch, facts };
}
