import { NextResponse } from "next/server";
import { isSupabaseConfigured, safeNextPath } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { postAuthRedirectPath } from "@/lib/terms/post-auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      const destination = userId
        ? await postAuthRedirectPath(userId, next)
        : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=oauth&detail=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
