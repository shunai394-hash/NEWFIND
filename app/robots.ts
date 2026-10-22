import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://newfind-self.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/feed", "/discover", "/products", "/p/", "/u/"],
      disallow: [
        "/api/",
        "/admin/",
        "/auth/",
        "/login",
        "/signup",
        "/settings/",
        "/saved/",
        "/notifications/",
        "/following/",
        "/create/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
