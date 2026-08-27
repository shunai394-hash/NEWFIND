import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/request-user";
import {
  isProductSaved,
  listSavedProductIds,
  listSavedProducts,
  toggleProductSave,
} from "@/lib/discovery/saves";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    if (productId) {
      const saved = await isProductSaved(auth.userId, productId);
      return NextResponse.json({ saved, productId });
    }
    const hydrate = url.searchParams.get("hydrate") !== "0";
    const productIds = await listSavedProductIds(auth.userId);
    const products = hydrate ? await listSavedProducts(auth.userId) : [];
    return NextResponse.json({ productIds, products });
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as { productId?: string };
    const productId = body.productId?.trim();
    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }
    const result = await toggleProductSave(auth.userId, productId);
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = authErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
