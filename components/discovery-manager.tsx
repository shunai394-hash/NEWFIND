"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchDiscoveryList,
  patchDiscoveryProduct,
} from "@/lib/discovery/client-api";
import { isUsableProductImage } from "@/lib/discovery/media";
import {
  DISCOVERY_CATEGORY_LABELS,
  DISCOVERY_STATUSES,
  type DiscoveryProduct,
  type DiscoveryStatus,
} from "@/lib/discovery/types";

const FILTERS: Array<DiscoveryStatus | "all"> = ["all", ...DISCOVERY_STATUSES];

export function DiscoveryManager() {
  const [status, setStatus] = useState<DiscoveryStatus | "all">("all");
  const [tick, setTick] = useState(0);
  const [products, setProducts] = useState<DiscoveryProduct[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchDiscoveryList(status)
      .then((data) => {
        if (!cancelled) {
          setProducts(data.products);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
          setProducts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status, tick]);

  async function setItemStatus(id: string, next: DiscoveryStatus) {
    try {
      await patchDiscoveryProduct(id, { status: next });
      setTick((value) => value + 1);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Discovery Manager</h1>
        <Link
          href="/admin/discovery/new"
          className="rounded-full bg-[#C6FF00] px-3 py-1.5 text-xs font-semibold text-black"
        >
          New
        </Link>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === id ? "bg-[#C6FF00] text-black" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {id === "all" ? "All" : id}
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-[11px]">
          <thead>
            <tr className="border-b text-neutral-400">
              <th className="py-2 pr-3">Image</th>
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">Brand</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Trend</th>
              <th className="py-2 pr-3">Conf</th>
              <th className="py-2 pr-3">Src</th>
              <th className="py-2 pr-3">Sales</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100 align-top">
                <td className="py-2 pr-3">
                  {isUsableProductImage(item.productImageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.productImageUrl ?? ""}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <span className="text-neutral-400">none</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <Link href={`/admin/discovery/${item.id}`} className="font-semibold">
                    {item.productName || "(untitled)"}
                  </Link>
                </td>
                <td className="py-2 pr-3">{item.brand}</td>
                <td className="py-2 pr-3">{DISCOVERY_CATEGORY_LABELS[item.category]}</td>
                <td className="py-2 pr-3">{item.trendScore}</td>
                <td className="py-2 pr-3">{item.confidenceScore}</td>
                <td className="py-2 pr-3">{item.sources.length}</td>
                <td className="py-2 pr-3">{item.sales.length}</td>
                <td className="py-2 pr-3">
                  <p>{item.status}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button type="button" className="underline" onClick={() => void setItemStatus(item.id, "pending")}>
                      Pending
                    </button>
                    <button type="button" className="underline" onClick={() => void setItemStatus(item.id, "approved")}>
                      Approve
                    </button>
                    <button type="button" className="underline" onClick={() => void setItemStatus(item.id, "rejected")}>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
