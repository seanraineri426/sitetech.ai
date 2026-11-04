import type { MetadataRoute } from "next";
import { SITE_URL as siteUrl } from "@/lib/site";

// Update when page content materially changes.
const LAST_UPDATED = "2026-11-03";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified: LAST_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/contact`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/privacy`, lastModified: LAST_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
