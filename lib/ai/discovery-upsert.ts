import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalProductUrl } from "@/lib/discovery/rules";
import { normalizeBrand, normalizeProductName, sourceDomain } from "@/lib/discovery/normalize";
import { productIdentityKey } from "@/lib/ai/product-identity";
import type { ProductHunterCandidate } from "@/lib/ai/product-hunter";
import type { DiscoveryStatus } from "@/lib/discovery/types";

export type ScoutDiscoveryRecord = {
  productId: string;
  isNew: boolean;
  sourceAttached: boolean;
  status: DiscoveryStatus;
};

function signalFromSources(sourceCount: number) {
  return Math.max(0, Math.min(100, sourceCount * 20));
}

async function findExistingProductId(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    productUrl: string;
    officialUrl: string | null;
    duplicateKey: string;
  },
): Promise<string | null> {
  if (input.productUrl) {
    const byUrl = await admin
      .from("discovery_products")
      .select("id")
      .eq("product_url", input.productUrl)
      .maybeSingle();
    if (byUrl.data?.id) return byUrl.data.id as string;
  }
  if (input.officialUrl) {
    const byOfficial = await admin
      .from("discovery_products")
      .select("id")
      .eq("official_url", input.officialUrl)
      .maybeSingle();
    if (byOfficial.data?.id) return byOfficial.data.id as string;
  }
  if (input.duplicateKey) {
    const byKey = await admin
      .from("discovery_products")
      .select("id")
      .eq("duplicate_key", input.duplicateKey)
      .maybeSingle();
    if (!byKey.error && byKey.data?.id) return byKey.data.id as string;
  }
  return null;
}

async function attachScoutSource(input: {
  productId: string;
  scoutId: string;
  sourceUrl: string;
  sourceName: string;
  sourceType: string;
  sourceTitle: string;
  sourceExcerpt: string;
  publishedAt: string | null;
}) {
  const admin = createAdminClient();
  const existing = await admin
    .from("discovery_sources")
    .select("id")
    .eq("product_id", input.productId)
    .eq("source_url", input.sourceUrl)
    .eq("scout_id", input.scoutId)
    .maybeSingle();

  if (existing.data?.id) {
    return { attached: false, sourceCount: null as number | null };
  }

  const insert = await admin.from("discovery_sources").insert({
    product_id: input.productId,
    source_type: input.sourceType,
    source_url: input.sourceUrl,
    source_title: input.sourceTitle,
    source_domain: sourceDomain(input.sourceUrl),
    published_at: input.publishedAt,
    source_excerpt: input.sourceExcerpt,
    verification_status: "unverified",
    source_tier: input.sourceType === "brand_official" ? 1 : 4,
    scout_id: input.scoutId,
    source_name: input.sourceName,
  });

  if (insert.error && /scout_id|source_name|42703/i.test(insert.error.message)) {
    const retry = await admin.from("discovery_sources").insert({
      product_id: input.productId,
      source_type: input.sourceType,
      source_url: input.sourceUrl,
      source_title: input.sourceTitle,
      source_domain: sourceDomain(input.sourceUrl),
      published_at: input.publishedAt,
      source_excerpt: input.sourceExcerpt,
      verification_status: "unverified",
      source_tier: input.sourceType === "brand_official" ? 1 : 4,
    });
    if (retry.error && !/duplicate|23505/i.test(retry.error.message)) {
      throw new Error(retry.error.message);
    }
  } else if (insert.error && !/duplicate|23505/i.test(insert.error.message)) {
    throw new Error(insert.error.message);
  }

  const sources = await admin
    .from("discovery_sources")
    .select("id", { count: "exact", head: true })
    .eq("product_id", input.productId);
  const sourceCount = typeof sources.count === "number" ? sources.count : null;

  if (sourceCount != null) {
    const patch: Record<string, unknown> = {
      source_count: sourceCount,
      signal_strength: signalFromSources(sourceCount),
      updated_at: new Date().toISOString(),
    };
    const update = await admin
      .from("discovery_products")
      .update(patch)
      .eq("id", input.productId);
    if (update.error && /source_count|signal_strength|42703/i.test(update.error.message)) {
      // Column not migrated yet; keep the extra source row.
    }
  }

  return { attached: true, sourceCount };
}

export async function upsertScoutDiscovery(input: {
  scoutId: string;
  scoutName: string;
  beatKey: string;
  candidate: ProductHunterCandidate;
}): Promise<ScoutDiscoveryRecord> {
  const admin = createAdminClient();
  const productUrl = canonicalProductUrl(input.candidate.productUrl);
  const officialUrl = input.candidate.officialUrl
    ? canonicalProductUrl(input.candidate.officialUrl)
    : null;
  const duplicateKey = productIdentityKey({
    brand: input.candidate.brand,
    productName: input.candidate.productName,
    sku: input.candidate.sku,
    gtin: input.candidate.gtin,
    modelNumber: input.candidate.modelNumber,
    productUrl,
    officialUrl,
  });
  const verified =
    input.candidate.confidenceScore >= 55 &&
    input.candidate.origin !== "catalog";
  const status: DiscoveryStatus = verified ? "pending" : "draft";
  const existingId = await findExistingProductId(admin, {
    productUrl,
    officialUrl,
    duplicateKey,
  });

  const sourcePayload = {
    scoutId: input.scoutId,
    sourceUrl: productUrl,
    sourceName: input.scoutName,
    sourceType: officialUrl ? "brand_official" : "other",
    sourceTitle: `${input.candidate.brand} - ${input.candidate.productName}`,
    sourceExcerpt: input.candidate.description,
    publishedAt: input.candidate.launchDate,
  };

  if (existingId) {
    const attached = await attachScoutSource({
      productId: existingId,
      ...sourcePayload,
    });
    return {
      productId: existingId,
      isNew: false,
      sourceAttached: attached.attached,
      status,
    };
  }

  const now = new Date().toISOString();
  const productId = crypto.randomUUID();
  const payload: Record<string, unknown> = {
    id: productId,
    brand: input.candidate.brand,
    product_name: input.candidate.productName,
    category: input.candidate.category,
    subcategory: input.candidate.subcategory,
    country: input.candidate.country,
    description: input.candidate.description,
    product_image_url: input.candidate.productImageUrl,
    product_url: productUrl,
    official_url: officialUrl,
    price: input.candidate.price,
    currency: input.candidate.currency || "USD",
    sku: input.candidate.sku,
    gtin: input.candidate.gtin,
    model_number: input.candidate.modelNumber,
    launch_date: input.candidate.launchDate,
    canonical_url: input.candidate.report.canonicalUrl,
    discovery_report: input.candidate.report,
    trend_score: input.candidate.trendScore,
    confidence_score: input.candidate.confidenceScore,
    discovery_source: "ai_scout",
    discovered_by_resident_id: input.scoutId,
    status,
    normalized_brand: normalizeBrand(input.candidate.brand),
    normalized_product_name: normalizeProductName(input.candidate.productName),
    discovered_at: now,
    attention_reason: input.candidate.attentionReason,
    duplicate_key: duplicateKey,
    verification_score: input.candidate.confidenceScore,
    scout_beat: input.beatKey,
    source_count: 1,
    signal_strength: signalFromSources(1),
    trend_signal: input.candidate.trendTags.join(",") || null,
    first_seen_at: now,
    updated_at: now,
    created_at: now,
  };

  const insert = await admin.from("discovery_products").insert(payload);
  if (insert.error && /duplicate_key|verification_score|scout_beat|source_count|signal_strength|trend_signal|first_seen_at|42703/i.test(insert.error.message)) {
    delete payload.duplicate_key;
    delete payload.verification_score;
    delete payload.scout_beat;
    delete payload.source_count;
    delete payload.signal_strength;
    delete payload.trend_signal;
    delete payload.first_seen_at;
    const retry = await admin.from("discovery_products").insert(payload);
    if (retry.error) {
      if (/duplicate|23505/i.test(retry.error.message)) {
        const again = await findExistingProductId(admin, {
          productUrl,
          officialUrl,
          duplicateKey,
        });
        if (again) {
          const attached = await attachScoutSource({
            productId: again,
            ...sourcePayload,
          });
          return {
            productId: again,
            isNew: false,
            sourceAttached: attached.attached,
            status,
          };
        }
      }
      throw new Error(retry.error.message);
    }
  } else if (insert.error) {
    if (/duplicate|23505/i.test(insert.error.message)) {
      const again = await findExistingProductId(admin, {
        productUrl,
        officialUrl,
        duplicateKey,
      });
      if (again) {
        const attached = await attachScoutSource({
          productId: again,
          ...sourcePayload,
        });
        return {
          productId: again,
          isNew: false,
          sourceAttached: attached.attached,
          status,
        };
      }
    }
    throw new Error(insert.error.message);
  }

  await attachScoutSource({
    productId,
    ...sourcePayload,
  });

  if (input.candidate.trendTags.length > 0) {
    await admin.from("discovery_product_tags").insert(
      input.candidate.trendTags.map((tag) => ({ product_id: productId, tag })),
    );
  }

  return {
    productId,
    isNew: true,
    sourceAttached: true,
    status,
  };
}
