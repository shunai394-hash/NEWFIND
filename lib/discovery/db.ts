import { createAdminClient } from "@/lib/supabase/admin";
import { isUsableProductImage } from "@/lib/discovery/media";
import { normalizeBrand, normalizeProductName, sourceDomain } from "@/lib/discovery/normalize";
import { asUuid, isUuid } from "@/lib/discovery/rules";
import type {
  DiscoveryCategory,
  DiscoveryPerson,
  DiscoveryProduct,
  DiscoveryProductInput,
  DiscoverySale,
  DiscoverySource,
  DiscoveryStatus,
  PersonRelation,
  PersonType,
  SellerKind,
  SourceTier,
  SourceType,
  TrendTag,
} from "@/lib/discovery/types";

type ProductRow = {
  id: string;
  brand: string;
  product_name: string;
  category: string;
  subcategory: string | null;
  country: string | null;
  description: string | null;
  product_image_url: string | null;
  product_url: string | null;
  official_url: string | null;
  price: number | null;
  currency: string | null;
  sku: string | null;
  trend_score: number | null;
  confidence_score: number | null;
  discovery_source: string | null;
  status: string;
  normalized_brand: string | null;
  normalized_product_name: string | null;
  discovered_at?: string | null;
  attention_reason?: string | null;
  created_at: string;
  updated_at: string;
};

type SourceRow = {
  id: string;
  product_id: string;
  source_type: string;
  source_url: string;
  source_title: string | null;
  source_domain: string | null;
  published_at: string | null;
  source_excerpt: string | null;
  verification_status: string | null;
  source_tier: number | null;
  created_at: string;
};

type PersonRow = {
  id: string;
  product_id: string;
  person_name: string;
  person_type: string;
  person_url: string | null;
  person_image_url: string | null;
  relation: string;
  source_id: string | null;
  created_at: string;
};

type SaleRow = {
  id: string;
  product_id: string;
  seller_name: string;
  product_url: string;
  price: number | null;
  currency: string | null;
  availability: string | null;
  official_store: boolean | null;
  seller_kind: string | null;
  affiliate_url: string | null;
  last_verified_at: string | null;
  created_at: string;
};

type TagRow = { product_id: string; tag: string };

function adminDb() {
  return createAdminClient();
}

function discoveryDb() {
  return adminDb();
}

function mapSource(row: SourceRow): DiscoverySource {
  return {
    id: row.id,
    sourceType: row.source_type as SourceType,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title ?? "",
    sourceDomain: row.source_domain,
    publishedAt: row.published_at,
    sourceExcerpt: row.source_excerpt,
    verificationStatus: (row.verification_status as DiscoverySource["verificationStatus"]) ?? "unverified",
    sourceTier: (row.source_tier as SourceTier) ?? 4,
    createdAt: row.created_at,
  };
}

function mapPerson(row: PersonRow): DiscoveryPerson {
  return {
    id: row.id,
    personName: row.person_name,
    personType: row.person_type as PersonType,
    personUrl: row.person_url,
    personImageUrl: row.person_image_url,
    relation: row.relation as PersonRelation,
    sourceId: row.source_id,
    createdAt: row.created_at,
  };
}

function mapSale(row: SaleRow): DiscoverySale {
  return {
    id: row.id,
    sellerName: row.seller_name,
    productUrl: row.product_url,
    price: row.price,
    currency: row.currency,
    availability: (row.availability as DiscoverySale["availability"]) ?? "unknown",
    officialStore: Boolean(row.official_store),
    sellerKind: (row.seller_kind as SellerKind) ?? "retailer",
    affiliateUrl: row.affiliate_url,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
  };
}

function mapProduct(
  row: ProductRow,
  sources: DiscoverySource[],
  people: DiscoveryPerson[],
  sales: DiscoverySale[],
  tags: TrendTag[],
): DiscoveryProduct {
  return {
    id: row.id,
    brand: row.brand,
    productName: row.product_name,
    category: row.category as DiscoveryCategory,
    subcategory: row.subcategory ?? "",
    country: row.country,
    description: row.description ?? "",
    productImageUrl: row.product_image_url,
    productUrl: row.product_url,
    officialUrl: row.official_url,
    price: row.price,
    currency: row.currency ?? "USD",
    sku: row.sku,
    trendScore: row.trend_score ?? 0,
    confidenceScore: row.confidence_score ?? 0,
    discoverySource: row.discovery_source,
    status: row.status as DiscoveryStatus,
    normalizedBrand: row.normalized_brand ?? normalizeBrand(row.brand),
    normalizedProductName: row.normalized_product_name ?? normalizeProductName(row.product_name),
    discoveredAt: row.discovered_at ?? null,
    attentionReason: row.attention_reason ?? "",
    trendTags: tags,
    sources,
    people,
    sales,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hydrate(
  supabase: ReturnType<typeof adminDb>,
  rows: ProductRow[],
): Promise<DiscoveryProduct[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [sourcesRes, peopleRes, salesRes, tagsRes] = await Promise.all([
    supabase.from("discovery_sources").select("*").in("product_id", ids),
    supabase.from("discovery_product_people").select("*").in("product_id", ids),
    supabase.from("discovery_product_sales").select("*").in("product_id", ids),
    supabase.from("discovery_product_tags").select("product_id, tag").in("product_id", ids),
  ]);
  if (sourcesRes.error) throw new Error(sourcesRes.error.message);
  if (peopleRes.error) throw new Error(peopleRes.error.message);
  if (salesRes.error) throw new Error(salesRes.error.message);
  if (tagsRes.error) throw new Error(tagsRes.error.message);

  const sources = (sourcesRes.data ?? []) as SourceRow[];
  const people = (peopleRes.data ?? []) as PersonRow[];
  const sales = (salesRes.data ?? []) as SaleRow[];
  const tags = (tagsRes.data ?? []) as TagRow[];

  return rows.map((row) =>
    mapProduct(
      row,
      sources.filter((item) => item.product_id === row.id).map(mapSource),
      people.filter((item) => item.product_id === row.id).map(mapPerson),
      sales.filter((item) => item.product_id === row.id).map(mapSale),
      tags.filter((item) => item.product_id === row.id).map((item) => item.tag as TrendTag),
    ),
  );
}

function applyPublicFilter(products: DiscoveryProduct[], admin: boolean) {
  return products.filter((item) => {
    if (!admin && item.status !== "approved") return false;
    if (!admin && !isUsableProductImage(item.productImageUrl)) return false;
    return true;
  });
}

export async function listDiscoveryProductsFromDb(options?: {
  status?: DiscoveryStatus | "all";
  admin?: boolean;
}) {
  const admin = Boolean(options?.admin);
  const status = options?.status ?? (admin ? "all" : "approved");
  const supabase = discoveryDb();
  let query = supabase
    .from("discovery_products")
    .select("*")
    .order("trend_score", { ascending: false });
  if (!admin) query = query.eq("status", "approved");
  else if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const products = await hydrate(discoveryDb(), (data ?? []) as ProductRow[]);
  return applyPublicFilter(products, admin).filter((item) => {
    if (admin && status !== "all" && item.status !== status) return false;
    return true;
  });
}

export async function getDiscoveryProductFromDb(id: string, admin = false) {
  const supabase = discoveryDb();
  let query = supabase.from("discovery_products").select("*").eq("id", id);
  if (!admin) query = query.eq("status", "approved");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [product] = await hydrate(discoveryDb(), [data as ProductRow]);
  if (!product) return null;
  return applyPublicFilter([product], admin)[0] ?? null;
}

export async function saveDiscoveryProductToDb(input: DiscoveryProductInput) {
  const supabase = discoveryDb();
  const now = new Date().toISOString();
  const productPayload: Record<string, unknown> = {
    id: input.id,
    brand: input.brand,
    product_name: input.productName,
    category: input.category,
    subcategory: input.subcategory ?? "",
    country: input.country,
    description: input.description ?? "",
    product_image_url: input.productImageUrl,
    product_url: input.productUrl,
    official_url: input.officialUrl,
    price: input.price,
    currency: input.currency || "USD",
    sku: input.sku,
    trend_score: input.trendScore ?? 0,
    confidence_score: input.confidenceScore ?? 0,
    discovery_source: input.discoverySource,
    status: input.status,
    normalized_brand: normalizeBrand(input.brand),
    normalized_product_name: normalizeProductName(input.productName),
    discovered_at: input.discoveredAt || null,
    attention_reason: input.attentionReason ?? "",
    updated_at: now,
  };
  if (input.createdAt) productPayload.created_at = input.createdAt;

  const { error: productError } = await supabase
    .from("discovery_products")
    .upsert(productPayload, { onConflict: "id" });
  if (productError) {
    if (/discovered_at|attention_reason|42703/i.test(productError.message)) {
      delete productPayload.discovered_at;
      delete productPayload.attention_reason;
      const retry = await supabase.from("discovery_products").upsert(productPayload, { onConflict: "id" });
      if (retry.error) throw new Error(retry.error.message);
    } else {
      throw new Error(productError.message);
    }
  }

  const deletes = await Promise.all([
    supabase.from("discovery_sources").delete().eq("product_id", input.id),
    supabase.from("discovery_product_people").delete().eq("product_id", input.id),
    supabase.from("discovery_product_sales").delete().eq("product_id", input.id),
    supabase.from("discovery_product_tags").delete().eq("product_id", input.id),
  ]);
  for (const result of deletes) {
    if (result.error) throw new Error(result.error.message);
  }

  const sourceIdMap = new Map<string, string>();

  if (input.sources.length > 0) {
    const { error } = await supabase.from("discovery_sources").insert(
      input.sources.map((item) => {
        const id = asUuid(item.id);
        sourceIdMap.set(item.id, id);
        return {
          id,
          product_id: input.id,
          source_type: item.sourceType,
          source_url: item.sourceUrl,
          source_title: item.sourceTitle ?? "",
          source_domain: item.sourceDomain || sourceDomain(item.sourceUrl),
          published_at: item.publishedAt,
          source_excerpt: item.sourceExcerpt,
          verification_status: item.verificationStatus,
          source_tier: item.sourceTier,
          created_at: item.createdAt,
        };
      }),
    );
    if (error) throw new Error(error.message);
  }

  if (input.people.length > 0) {
    const { error } = await supabase.from("discovery_product_people").insert(
      input.people.map((item) => {
        const mappedSource =
          (item.sourceId && sourceIdMap.get(item.sourceId)) ||
          (isUuid(item.sourceId) ? item.sourceId : null);
        return {
          id: asUuid(item.id),
          product_id: input.id,
          person_name: item.personName,
          person_type: item.personType,
          person_url: item.personUrl,
          person_image_url: item.personImageUrl,
          relation: item.relation,
          source_id: mappedSource,
          created_at: item.createdAt,
        };
      }),
    );
    if (error) throw new Error(error.message);
  }

  if (input.sales.length > 0) {
    const { error } = await supabase.from("discovery_product_sales").insert(
      input.sales.map((item) => ({
        id: asUuid(item.id),
        product_id: input.id,
        seller_name: item.sellerName,
        product_url: item.productUrl,
        price: item.price,
        currency: item.currency,
        availability: item.availability,
        official_store: item.officialStore,
        seller_kind: item.sellerKind,
        affiliate_url: item.affiliateUrl,
        last_verified_at: item.lastVerifiedAt,
        created_at: item.createdAt,
      })),
    );
    if (error) throw new Error(error.message);
  }

  if (input.trendTags.length > 0) {
    const { error } = await supabase.from("discovery_product_tags").insert(
      input.trendTags.map((tag) => ({ product_id: input.id, tag })),
    );
    if (error) throw new Error(error.message);
  }

  const saved = await getDiscoveryProductFromDb(input.id, true);
  if (!saved) throw new Error("Product not found after save");
  return saved;
}
