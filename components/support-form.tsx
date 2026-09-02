"use client";

import { FormEvent, useState } from "react";

const categories = [
  "不具合",
  "アカウント",
  "投稿・コンテンツ",
  "通報について",
  "その他",
];

export function SupportForm() {
  const [category, setCategory] = useState("不具合");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("sending");
    setErrorMessage("");

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          email,
          subject,
          message,
          website: "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "送信に失敗しました。");
      }

      setStatus("success");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "送信に失敗しました。"
      );
    }
  }

  if (status === "success") {
    return (
      <div className="py-8 text-center">
        <div className="text-4xl">✓</div>
        <h2 className="mt-4 text-xl font-bold">お問い合わせを受け付けました</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          お問い合わせありがとうございます。
          <br />
          内容を確認のうえ対応いたします。
        </p>

        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white"
        >
          続けて問い合わせる
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold">お問い合わせ内容</label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-black"
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">
          返信先メールアドレス（任意）
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={320}
          placeholder="example@example.com"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">件名</label>
        <input
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={200}
          placeholder="お問い合わせの件名"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold">内容</label>
        <textarea
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={5000}
          rows={7}
          placeholder="お問い合わせ内容をご入力ください。"
          className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
        />
      </div>

      {status === "error" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl bg-black px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {status === "sending" ? "送信中..." : "お問い合わせを送信"}
      </button>
    </form>
  );
}
