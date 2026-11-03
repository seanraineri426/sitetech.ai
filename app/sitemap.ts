import type { MetadataRoute } from "next";
import { insights } from "@/lib/insights";
import { SITE_URL as siteUrl } from "@/lib/site";

// Update when page content materially changes.
const LAST_UPDATED = "2026-11-03";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: LAST_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/data-fit`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/how-it-works`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/for-buyers`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/contact`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/privacy`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/blog`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.4 },
  ];

  const insightRoutes: MetadataRoute.Sitemap = insights.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date + "T00:00:00"),
    changeFrequency: "yearly",
    priority: 0.3,
  }));

  return [...staticRoutes, ...insightRoutes];
}
