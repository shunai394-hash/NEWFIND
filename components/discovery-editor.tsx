"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchDiscoveryProduct,
  saveDiscoveryProductApi,
} from "@/lib/discovery/client-api";
import { canApprove, emptyDiscoveryProduct, newChildId } from "@/lib/discovery/rules";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CATEGORY_LABELS,
  DISCOVERY_ORIGINS,
  DISCOVERY_ORIGIN_LABELS,
  DISCOVERY_STATUSES,
  PERSON_RELATIONS,
  PERSON_TYPES,
  SELLER_KINDS,
  SOURCE_TYPES,
  TREND_TAG_LABELS,
  TREND_TAGS,
  type DiscoveryProductInput,
  type DiscoveryStatus,
  type TrendTag,
} from "@/lib/discovery/types";

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-500">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-900"
      />
    </label>
  );
}

export function DiscoveryEditor({ id }: { id: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<DiscoveryProductInput>(emptyDiscoveryProduct());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(id !== "new");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id === "new") return;
    let cancelled = false;
    fetchDiscoveryProduct(id)
      .then((item) => {
        if (cancelled) return;
        setProduct(item ?? emptyDiscoveryProduct());
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function update<K extends keyof DiscoveryProductInput>(key: K, value: DiscoveryProductInput[K]) {
    setProduct((current) => ({ ...current, [key]: value }));
  }

  async function save(status?: DiscoveryStatus) {
    setError("");
    setBusy(true);
    try {
      const next = { ...product, status: status ?? product.status };
      if (next.status === "approved" && !canApprove(next)) {
        throw new Error("Approve needs image, source, and a live sales page.");
      }
      const saved = await saveDiscoveryProductApi(next);
      router.replace(`/admin/discovery/${saved.id}`);
      setProduct(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const selectedTags = new Set(product.trendTags);

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">Loading...</p>;
  }

  return (
    <div className="space-y-6 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Edit product</h1>
        <p className="text-xs text-neutral-400">{product.status}</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Product</h2>
        <Field label="Image URL" value={product.productImageUrl ?? ""} onChange={(value) => update("productImageUrl", value || null)} />
        <Field label="Brand" value={product.brand} onChange={(value) => update("brand", value)} />
        <Field label="Product name" value={product.productName} onChange={(value) => update("productName", value)} />
        <label className="block text-xs font-semibold text-neutral-500">
          Description
          <textarea
            value={product.description}
            onChange={(event) => update("description", event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-semibold text-neutral-500">
          Category
          <select
            value={product.category}
            onChange={(event) => update("category", event.target.value as DiscoveryProductInput["category"])}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            {DISCOVERY_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {DISCOVERY_CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <Field label="Subcategory" value={product.subcategory} onChange={(value) => update("subcategory", value)} />
        <Field label="Country" value={product.country ?? ""} onChange={(value) => update("country", value || null)} />
        <Field label="Product URL" value={product.productUrl ?? ""} onChange={(value) => update("productUrl", value || null)} />
        <Field label="Official URL" value={product.officialUrl ?? ""} onChange={(value) => update("officialUrl", value || null)} />
        <Field
          label="Price"
          value={product.price == null ? "" : String(product.price)}
          onChange={(value) => update("price", value ? Number(value) : null)}
        />
        <Field label="Currency" value={product.currency} onChange={(value) => update("currency", value)} />
        <Field label="SKU" value={product.sku ?? ""} onChange={(value) => update("sku", value || null)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Discovery</h2>
        <label className="block text-xs font-semibold text-neutral-500">
          Discovery origin
          <select
            value={product.discoverySource ?? "admin"}
            onChange={(event) => update("discoverySource", event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            {DISCOVERY_ORIGINS.map((item) => (
              <option key={item} value={item}>
                {DISCOVERY_ORIGIN_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Discovered at"
          value={product.discoveredAt ?? ""}
          onChange={(value) => update("discoveredAt", value || null)}
        />
        <label className="block text-xs font-semibold text-neutral-500">
          Attention reason
          <textarea
            value={product.attentionReason ?? ""}
            onChange={(event) => update("attentionReason", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <Field
          label="Trend score"
          value={String(product.trendScore)}
          onChange={(value) => update("trendScore", Number(value) || 0)}
        />
        <Field
          label="Confidence score"
          value={String(product.confidenceScore)}
          onChange={(value) => update("confidenceScore", Number(value) || 0)}
        />
        <div className="flex flex-wrap gap-2">
          {TREND_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                const next = new Set(selectedTags);
                if (next.has(tag)) next.delete(tag);
                else next.add(tag);
                update("trendTags", [...next] as TrendTag[]);
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                selectedTags.has(tag) ? "bg-[#C6FF00] text-black" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {TREND_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">People</h2>
          <button
            type="button"
            className="text-xs underline"
            onClick={() =>
              update("people", [
                ...product.people,
                {
                  id: newChildId(),
                  personName: "",
                  personType: "celebrity",
                  personUrl: null,
                  personImageUrl: null,
                  relation: "unknown",
                  sourceId: product.sources[0]?.id ?? null,
                  createdAt: new Date().toISOString(),
                },
              ])
            }
          >
            Add person
          </button>
        </div>
        {product.people.map((person, index) => (
          <div key={person.id} className="space-y-2 rounded-xl border border-neutral-200 p-3">
            <Field
              label="Person name"
              value={person.personName}
              onChange={(value) => {
                const people = [...product.people];
                people[index] = { ...person, personName: value };
                update("people", people);
              }}
            />
            <label className="block text-xs font-semibold text-neutral-500">
              Person type
              <select
                value={person.personType}
                onChange={(event) => {
                  const people = [...product.people];
                  people[index] = { ...person, personType: event.target.value as typeof person.personType };
                  update("people", people);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {PERSON_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-neutral-500">
              Relation
              <select
                value={person.relation}
                onChange={(event) => {
                  const people = [...product.people];
                  people[index] = { ...person, relation: event.target.value as typeof person.relation };
                  update("people", people);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {PERSON_RELATIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Person URL"
              value={person.personUrl ?? ""}
              onChange={(value) => {
                const people = [...product.people];
                people[index] = { ...person, personUrl: value || null };
                update("people", people);
              }}
            />
            <label className="block text-xs font-semibold text-neutral-500">
              Source
              <select
                value={person.sourceId ?? ""}
                onChange={(event) => {
                  const people = [...product.people];
                  people[index] = { ...person, sourceId: event.target.value || null };
                  update("people", people);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">none</option>
                {product.sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.sourceTitle || source.sourceUrl || source.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="text-xs text-red-600"
              onClick={() => update("people", product.people.filter((item) => item.id !== person.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sources</h2>
          <button
            type="button"
            className="text-xs underline"
            onClick={() =>
              update("sources", [
                ...product.sources,
                {
                  id: newChildId(),
                  sourceType: "editorial",
                  sourceUrl: "",
                  sourceTitle: "",
                  sourceDomain: null,
                  publishedAt: null,
                  sourceExcerpt: null,
                  verificationStatus: "unverified",
                  sourceTier: 3,
                  createdAt: new Date().toISOString(),
                },
              ])
            }
          >
            Add source
          </button>
        </div>
        {product.sources.map((source, index) => (
          <div key={source.id} className="space-y-2 rounded-xl border border-neutral-200 p-3">
            <Field
              label="Title"
              value={source.sourceTitle}
              onChange={(value) => {
                const sources = [...product.sources];
                sources[index] = { ...source, sourceTitle: value };
                update("sources", sources);
              }}
            />
            <Field
              label="URL"
              value={source.sourceUrl}
              onChange={(value) => {
                const sources = [...product.sources];
                sources[index] = { ...source, sourceUrl: value };
                update("sources", sources);
              }}
            />
            <Field
              label="Domain"
              value={source.sourceDomain ?? ""}
              onChange={(value) => {
                const sources = [...product.sources];
                sources[index] = { ...source, sourceDomain: value || null };
                update("sources", sources);
              }}
            />
            <Field
              label="Published date"
              value={source.publishedAt ?? ""}
              onChange={(value) => {
                const sources = [...product.sources];
                sources[index] = { ...source, publishedAt: value || null };
                update("sources", sources);
              }}
            />
            <label className="block text-xs font-semibold text-neutral-500">
              Excerpt
              <textarea
                value={source.sourceExcerpt ?? ""}
                onChange={(event) => {
                  const sources = [...product.sources];
                  sources[index] = { ...source, sourceExcerpt: event.target.value || null };
                  update("sources", sources);
                }}
                rows={3}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-semibold text-neutral-500">
              Type
              <select
                value={source.sourceType}
                onChange={(event) => {
                  const sources = [...product.sources];
                  sources[index] = { ...source, sourceType: event.target.value as typeof source.sourceType };
                  update("sources", sources);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {SOURCE_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-neutral-500">
              Verification
              <select
                value={source.verificationStatus}
                onChange={(event) => {
                  const sources = [...product.sources];
                  sources[index] = {
                    ...source,
                    verificationStatus: event.target.value as typeof source.verificationStatus,
                  };
                  update("sources", sources);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="unverified">unverified</option>
                <option value="verified">verified</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <Field
              label="Tier (1-4)"
              value={String(source.sourceTier)}
              onChange={(value) => {
                const sources = [...product.sources];
                const tier = Math.min(4, Math.max(1, Number(value) || 4)) as 1 | 2 | 3 | 4;
                sources[index] = { ...source, sourceTier: tier };
                update("sources", sources);
              }}
            />
            <button
              type="button"
              className="text-xs text-red-600"
              onClick={() => update("sources", product.sources.filter((item) => item.id !== source.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sales</h2>
          <button
            type="button"
            className="text-xs underline"
            onClick={() =>
              update("sales", [
                ...product.sales,
                {
                  id: newChildId(),
                  sellerName: "",
                  productUrl: "",
                  price: null,
                  currency: product.currency,
                  availability: "unknown",
                  officialStore: false,
                  sellerKind: "retailer",
                  affiliateUrl: null,
                  lastVerifiedAt: null,
                  createdAt: new Date().toISOString(),
                },
              ])
            }
          >
            Add seller
          </button>
        </div>
        {product.sales.map((sale, index) => (
          <div key={sale.id} className="space-y-2 rounded-xl border border-neutral-200 p-3">
            <Field
              label="Seller"
              value={sale.sellerName}
              onChange={(value) => {
                const sales = [...product.sales];
                sales[index] = { ...sale, sellerName: value };
                update("sales", sales);
              }}
            />
            <Field
              label="Product URL"
              value={sale.productUrl}
              onChange={(value) => {
                const sales = [...product.sales];
                sales[index] = { ...sale, productUrl: value };
                update("sales", sales);
              }}
            />
            <Field
              label="Price"
              value={sale.price == null ? "" : String(sale.price)}
              onChange={(value) => {
                const sales = [...product.sales];
                sales[index] = { ...sale, price: value ? Number(value) : null };
                update("sales", sales);
              }}
            />
            <Field
              label="Currency"
              value={sale.currency ?? ""}
              onChange={(value) => {
                const sales = [...product.sales];
                sales[index] = { ...sale, currency: value || null };
                update("sales", sales);
              }}
            />
            <label className="block text-xs font-semibold text-neutral-500">
              Kind
              <select
                value={sale.sellerKind}
                onChange={(event) => {
                  const sales = [...product.sales];
                  sales[index] = { ...sale, sellerKind: event.target.value as typeof sale.sellerKind };
                  update("sales", sales);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {SELLER_KINDS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sale.officialStore}
                onChange={(event) => {
                  const sales = [...product.sales];
                  sales[index] = { ...sale, officialStore: event.target.checked };
                  update("sales", sales);
                }}
              />
              Official store
            </label>
            <label className="block text-xs font-semibold text-neutral-500">
              Availability
              <select
                value={sale.availability}
                onChange={(event) => {
                  const sales = [...product.sales];
                  sales[index] = {
                    ...sale,
                    availability: event.target.value as typeof sale.availability,
                  };
                  update("sales", sales);
                }}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="unknown">unknown</option>
                <option value="in_stock">in stock</option>
                <option value="out_of_stock">out of stock</option>
              </select>
            </label>
            <Field
              label="Affiliate URL (optional)"
              value={sale.affiliateUrl ?? ""}
              onChange={(value) => {
                const sales = [...product.sales];
                sales[index] = { ...sale, affiliateUrl: value || null };
                update("sales", sales);
              }}
            />
            <Field
              label="Last verified at"
              value={sale.lastVerifiedAt ?? ""}
              onChange={(value) => {
                const sales = [...product.sales];
                sales[index] = { ...sale, lastVerifiedAt: value || null };
                update("sales", sales);
              }}
            />
            <button
              type="button"
              className="text-xs text-red-600"
              onClick={() => update("sales", product.sales.filter((item) => item.id !== sale.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-2 pb-8">
        <h2 className="text-sm font-semibold">Status</h2>
        <div className="flex flex-wrap gap-2">
          {DISCOVERY_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => void save(status)}
              disabled={busy}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold"
            >
              {status === "approved" ? "Approve" : status === "rejected" ? "Reject" : status}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="rounded-full bg-[#C6FF00] px-3 py-1.5 text-xs font-semibold text-black"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </section>
    </div>
  );
}
