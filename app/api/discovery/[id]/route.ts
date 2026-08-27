import { NextResponse } from "next/server";
import { getDiscoveryAdminState } from "@/lib/discovery/server-auth";
import { isUsableProductImage } from "@/lib/discovery/media";
import { getDiscoveryProduct, saveDiscoveryProduct, setDiscoveryStatus } from "@/lib/discovery/store";
import type { DiscoveryStatus } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { admin } = await getDiscoveryAdminState(request);
  const product = await getDiscoveryProduct(id, admin);
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!admin && !isUsableProductImage(product.productImageUrl)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ product, admin });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin } = await getDiscoveryAdminState(request);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  try {
    if (body.status && Object.keys(body).length === 1) {
      const product = await setDiscoveryStatus(id, body.status as DiscoveryStatus);
      return NextResponse.json({ product });
    }
    const product = await saveDiscoveryProduct({ ...body, id });
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "save failed" },
      { status: 400 },
    );
  }
}
