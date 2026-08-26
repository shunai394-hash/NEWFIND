import { NextResponse } from "next/server";
import { getDiscoveryAdminState } from "@/lib/discovery/server-auth";

export async function GET() {
  const state = await getDiscoveryAdminState();
  return NextResponse.json(state);
}
