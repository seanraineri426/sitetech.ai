import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async redirects() {
    // The site is three pages: "/", "/contact", "/privacy". Retired routes go
    // straight to their replacement in one hop. Temporary (307) so earlier
    // routes can be restored without fighting cached permanent redirects.
    return [
      { source: "/data-fit", destination: "/#quiz", permanent: false },
      { source: "/how-it-works", destination: "/#how", permanent: false },
      { source: "/platform", destination: "/#how", permanent: false },
      { source: "/for-buyers", destination: "/contact?topic=buyer", permanent: false },
      { source: "/pricing", destination: "/contact", permanent: false },
      { source: "/solutions", destination: "/", permanent: false },
      { source: "/solutions/:path*", destination: "/", permanent: false },
      { source: "/workflows", destination: "/", permanent: false },
      { source: "/integrations", destination: "/", permanent: false },
      { source: "/blog", destination: "/", permanent: false },
      { source: "/blog/:slug", destination: "/", permanent: false },
      { source: "/insights", destination: "/", permanent: false },
      { source: "/insights/:slug", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
