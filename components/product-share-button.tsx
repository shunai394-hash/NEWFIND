"use client";

import { useState } from "react";
import { ShareSheet } from "@/components/share-sheet";

export function ProductShareButton({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold"
      >
        シェア
      </button>
      {open ? (
        <ShareSheet url={url} title={title} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
