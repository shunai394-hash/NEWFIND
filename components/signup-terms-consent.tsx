"use client";

import Link from "next/link";

export function SignupTermsConsent({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3">
      <p className="text-xs leading-relaxed text-neutral-600">
        アカウントを作成するには、利用規約とプライバシーポリシーへの同意が必要です。
      </p>
      <label className="flex items-start gap-2 text-sm text-neutral-800">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          <Link href="/terms" target="_blank" className="font-semibold underline">
            利用規約
          </Link>
          と
          <Link href="/privacy" target="_blank" className="font-semibold underline">
            プライバシーポリシー
          </Link>
          に同意します
        </span>
      </label>
    </div>
  );
}
