import Link from "next/link";

export function AdminNav({ current }: { current: "home" | "users" | "posts" | "discovery" }) {
  const items = [
    { id: "home", href: "/admin", label: "管理" },
    { id: "users", href: "/admin/users", label: "ユーザー" },
    { id: "posts", href: "/admin/posts", label: "投稿" },
    { id: "discovery", href: "/admin/discovery", label: "Discovery" },
  ] as const;

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
            current === item.id ? "bg-[#C6FF00] text-black" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
