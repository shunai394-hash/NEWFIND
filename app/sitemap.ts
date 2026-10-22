import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://newfind-self.vercel.app").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicRoutes: Array<{ path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }> = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/feed", changeFrequency: "daily", priority: 0.9 },
    { path: "/discover", changeFrequency: "daily", priority: 0.9 },
    { path: "/products", changeFrequency: "daily", priority: 0.9 },
    { path: "/community-guidelines", changeFrequency: "monthly", priority: 0.4 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
    { path: "/support", changeFrequency: "monthly", priority: 0.4 },
  ];

  return publicRoutes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
