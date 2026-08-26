"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";

export function DiscoveryAdminGate({ children }: { children: React.ReactNode }) {
  const { ready, sessionResolved, session } = useApp();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ready || !sessionResolved) return;
    if (!session) {
      setAdmin(false);
      return;
    }
    fetch("/api/discovery/me")
      .then((response) => response.json())
      .then((data) => setAdmin(Boolean(data.admin)))
      .catch(() => setAdmin(false));
  }, [ready, sessionResolved, session]);

  if (!ready || !sessionResolved || admin === null) {
    return <p className="px-4 py-16 text-center text-sm text-neutral-400">Loading...</p>;
  }
  if (!session) {
    return (
      <p className="px-4 py-16 text-center text-sm">
        <Link href="/login?next=/admin/discovery" className="underline">
          Sign in
        </Link>{" "}
        to open Discovery Manager.
      </p>
    );
  }
  if (!admin) {
    return (
      <p className="px-4 py-16 text-center text-sm text-neutral-500">
        Discovery Manager is limited to admins.
      </p>
    );
  }
  return <>{children}</>;
}
