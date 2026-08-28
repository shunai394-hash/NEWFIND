import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-neutral-500">
        指定されたページは存在しないか、移動された可能性があります。
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-neutral-800"
      >
        ホームへ戻る
      </Link>
    </div>
  );
}
