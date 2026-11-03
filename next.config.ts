import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Pre-pivot redirects (unchanged).
      { source: "/platform", destination: "/how-it-works", permanent: true },
      { source: "/workflows", destination: "/solutions", permanent: true },
      { source: "/insights", destination: "/blog", permanent: true },
      { source: "/insights/:slug", destination: "/blog/:slug", permanent: true },

      // Data-referral pivot (2026-11). Temporary (307) so the original routes
      // can be restored without fighting cached permanent redirects.
      // The contact form previously lived at /pricing#contact.
      { source: "/pricing", destination: "/contact", permanent: false },
      // Retired AI-implementation service pages -> single context page.
      { source: "/solutions/affordable-housing", destination: "/solutions", permanent: false },
      { source: "/solutions/property-management", destination: "/solutions", permanent: false },
      { source: "/integrations", destination: "/solutions", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
