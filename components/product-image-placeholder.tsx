export function ProductImagePlaceholder({
  label = "商品画像はありません",
}: {
  label?: string;
}) {
  return (
    <div className="flex aspect-[4/5] w-full flex-col items-center justify-center bg-neutral-100 text-center">
      <p className="text-[11px] font-semibold tracking-wide text-neutral-400">NO IMAGE</p>
      <p className="mt-1 px-4 text-xs text-neutral-500">{label}</p>
    </div>
  );
}
