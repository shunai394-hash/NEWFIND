import { NextResponse } from "next/server";
import { getDiscoveryAdminState } from "@/lib/discovery/server-auth";
import { listDiscoveryProducts, saveDiscoveryProduct } from "@/lib/discovery/store";
import type { DiscoveryStatus } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  try {
    const { admin } = await getDiscoveryAdminState(request);
    const products = await listDiscoveryProducts({
      admin,
      status: admin
        ? ((status as DiscoveryStatus | "all") || "all")
        : "approved",
    });
    return NextResponse.json({ products, admin });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "load failed", products: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { admin } = await getDiscoveryAdminState(request);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const product = await saveDiscoveryProduct(await request.json());
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "save failed" },
      { status: 400 },
    );
  }
}
