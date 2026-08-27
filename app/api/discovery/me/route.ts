import { NextResponse } from "next/server";
import { getDiscoveryAdminState } from "@/lib/discovery/server-auth";

export async function GET(request: Request) {
  const state = await getDiscoveryAdminState(request);
  return NextResponse.json(state);
}
