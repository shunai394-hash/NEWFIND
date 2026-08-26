"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { listDiscoveryProducts, setDiscoveryStatus } from "@/lib/discovery/store";
import {
  DISCOVERY_CATEGORY_LABELS,
  type DiscoveryStatus,
} from "@/lib/discovery/types";

export function DiscoveryManager() {
  const [pendingOnly, setPendingOnly] = useState(false);
  const [tick, setTick] = useState(0);
  const products = useMemo(
    () =>
      listDiscoveryProducts({
        admin: true,
        status: pendingOnly ? "pending" : "all",
      }),
    [pendingOnly, tick],
  );

  async function setStatus(id: string, status: DiscoveryStatus) {
    try {
      setDiscoveryStatus(id, status);
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
          className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          New
        </Link>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pendingOnly}
          onChange={(event) => setPendingOnly(event.target.checked)}
        />
        Pending only
      </label>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-[11px]">
          <thead>
            <tr className="border-b text-neutral-400">
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Brand</th>
              <th className="py-2 pr-2">Category</th>
              <th className="py-2 pr-2">Trend</th>
              <th className="py-2 pr-2">Conf</th>
              <th className="py-2 pr-2">Src</th>
              <th className="py-2 pr-2">Sales</th>
              <th className="py-2 pr-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100 align-top">
                <td className="py-2 pr-2">
                  <Link href={`/admin/discovery/${item.id}`} className="font-semibold">
                    {item.productName || "(untitled)"}
                  </Link>
                </td>
                <td className="py-2 pr-2">{item.brand}</td>
                <td className="py-2 pr-2">{DISCOVERY_CATEGORY_LABELS[item.category]}</td>
                <td className="py-2 pr-2">{item.trendScore}</td>
                <td className="py-2 pr-2">{item.confidenceScore}</td>
                <td className="py-2 pr-2">{item.sources.length}</td>
                <td className="py-2 pr-2">{item.sales.length}</td>
                <td className="py-2 pr-2">
                  <p>{item.status}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button type="button" className="underline" onClick={() => setStatus(item.id, "pending")}>
                      Pending
                    </button>
                    <button type="button" className="underline" onClick={() => setStatus(item.id, "approved")}>
                      Approve
                    </button>
                    <button type="button" className="underline" onClick={() => setStatus(item.id, "rejected")}>
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
