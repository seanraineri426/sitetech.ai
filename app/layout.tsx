import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SITE_URL } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultTitle = "SiteTech AI | Get paid for company records or crew footage";
const defaultDescription =
  "SiteTech introduces construction, real estate, home services, and trades businesses to AI data partners. License records you already keep, or estimate robotics footage payout from crew hours.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: defaultTitle,
    template: "%s | SiteTech AI",
  },
  description: defaultDescription,
  keywords: [
    "AI data licensing",
    "sell company data to AI",
    "business data licensing",
    "construction data licensing",
    "real estate data licensing",
    "AI training data built environment",
    "license project documentation to AI",
    "construction imagery dataset licensing",
    "building records AI data",
    "data licensing referral",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: SITE_URL,
    siteName: "SiteTech AI",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SiteTech AI",
  url: SITE_URL,
  description:
    "SiteTech helps businesses in real estate, construction, design, and other industries explore potential AI data licensing introductions. SiteTech facilitates introductions; dataset evaluation and any licensing transaction are handled directly between the participating businesses.",
  logo: `${SITE_URL}/icon.png`,
  areaServed: "US",
  knowsAbout: [
    "Real estate development",
    "Construction",
    "Property and facilities management",
    "Architecture, engineering, and surveying",
    "AI training data licensing",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-black"
        >
          Skip to content
        </a>
        <Header />
        <div id="main">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
