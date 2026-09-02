import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function clean(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Honeypot field for basic bot protection.
    const website = clean(body?.website, 100);
    if (website) {
      return NextResponse.json({ ok: true });
    }

    const category = clean(body?.category, 50) || "その他";
    const email = clean(body?.email, 320);
    const subject = clean(body?.subject, 200);
    const message = clean(body?.message, 5000);

    if (!subject) {
      return NextResponse.json(
        { error: "件名を入力してください。" },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "お問い合わせ内容を入力してください。" },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "メールアドレスの形式が正しくありません。" },
        { status: 400 }
      );
    }

    const allowedCategories = [
      "不具合",
      "アカウント",
      "投稿・コンテンツ",
      "通報について",
      "その他",
    ];

    if (!allowedCategories.includes(category)) {
      return NextResponse.json(
        { error: "お問い合わせ内容が不正です。" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { error } = await admin.from("inquiries").insert({
      category,
      email: email || null,
      subject,
      message,
      status: "open",
    });

    if (error) {
      console.error("inquiry insert error:", error);
      return NextResponse.json(
        { error: "お問い合わせの送信に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("inquiry API error:", error);

    return NextResponse.json(
      { error: "お問い合わせの送信に失敗しました。" },
      { status: 500 }
    );
  }
}
