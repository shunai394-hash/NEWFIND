import Link from "next/link";

export function AdminNav({
  current,
}: {
  current: "home" | "users" | "posts" | "discovery" | "reports" | "inquiries";
}) {
  const items = [
    { id: "home", href: "/admin", label: "管理" },
    { id: "users", href: "/admin/users", label: "ユーザー" },
    { id: "posts", href: "/admin/posts", label: "投稿" },
    { id: "reports", href: "/admin/reports", label: "報告" },
    { id: "inquiries", href: "/admin/inquiries", label: "お問い合わせ" },
    { id: "discovery", href: "/admin/discovery", label: "Discovery" },
  ] as const;

  return (
    <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            current === item.id
              ? "bg-black text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
