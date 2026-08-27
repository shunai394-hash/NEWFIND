import { NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/auth/request-user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  return NextResponse.json({
    admin: auth.admin,
    email: auth.email,
    userId: auth.userId,
  });
}
