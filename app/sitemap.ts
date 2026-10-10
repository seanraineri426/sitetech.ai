import type { MetadataRoute } from "next";
import { insights } from "@/lib/marketing/insights";

const siteUrl = "https://sitetech.ai";

// Update when page content materially changes.
const LAST_UPDATED = "2026-08-24";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: LAST_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/solutions`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/solutions/affordable-housing`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/solutions/property-management`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/integrations`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/how-it-works`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/pricing`, lastModified: LAST_UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/blog`, lastModified: LAST_UPDATED, changeFrequency: "weekly", priority: 0.8 },
  ];

  const insightRoutes: MetadataRoute.Sitemap = insights.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date + "T00:00:00"),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...insightRoutes];
}
