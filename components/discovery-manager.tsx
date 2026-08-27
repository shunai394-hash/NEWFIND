"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { listDiscoveryProducts, setDiscoveryStatus } from "@/lib/discovery/store";
import {
  DISCOVERY_CATEGORY_LABELS,
  DISCOVERY_STATUSES,
  type DiscoveryStatus,
} from "@/lib/discovery/types";

const FILTERS: Array<DiscoveryStatus | "all"> = ["all", ...DISCOVERY_STATUSES];

export function DiscoveryManager() {
  const [status, setStatus] = useState<DiscoveryStatus | "all">("all");
  const [tick, setTick] = useState(0);
  const products = useMemo(
    () => listDiscoveryProducts({ admin: true, status }),
    [status, tick],
  );

  async function setItemStatus(id: string, next: DiscoveryStatus) {
    try {
      setDiscoveryStatus(id, next);
      setTick((value) => value + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Update failed");
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Discovery Manager</h1>
        <Link
          href="/admin/discovery/new"
          className="rounded-full bg-[#C6FF00] px-3 py-1.5 text-xs font-semibold text-black"
        >
          New
        </Link>
      </div>
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
                    <button type="button" className="underline" onClick={() => setItemStatus(item.id, "pending")}>
                      Pending
                    </button>
                    <button type="button" className="underline" onClick={() => setItemStatus(item.id, "approved")}>
                      Approve
                    </button>
                    <button type="button" className="underline" onClick={() => setItemStatus(item.id, "rejected")}>
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
