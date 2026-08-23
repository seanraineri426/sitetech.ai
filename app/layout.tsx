import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://sitetech.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SiteTech AI | AI infrastructure for real estate",
    template: "%s | SiteTech AI",
  },
  description:
    "SiteTech AI designs, deploys, and manages AI agents for real estate developers, owners, operators, and property managers — connecting the software your team already uses into an AI-powered operating system.",
  keywords: [
    "AI for real estate developers",
    "AI implementation for real estate",
    "AI for real estate brokerages",
    "real estate AI consulting",
    "AI automation for property management",
    "AI for affordable housing",
    "affordable housing leasing AI",
    "AI construction workflows",
    "AI real estate acquisitions",
    "real estate AI agents",
    "AI development management",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SiteTech AI | AI infrastructure for real estate",
    description:
      "AI agents designed, deployed, and managed for real estate developers, owners, operators, and property managers — built on the software your team already uses.",
    url: siteUrl,
    siteName: "SiteTech AI",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SiteTech AI | AI infrastructure for real estate",
    description:
      "AI agents designed, deployed, and managed for real estate developers, owners, operators, and property managers.",
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
  url: siteUrl,
  description:
    "AI infrastructure and implementation company for real estate developers, investors, owners, operators, and property managers, including affordable housing organizations.",
  logo: `${siteUrl}/icon.png`,
  areaServed: "US",
  knowsAbout: [
    "Real estate development",
    "Construction",
    "Property management",
    "Affordable housing leasing and compliance",
    "Real estate acquisitions and investment",
    "Artificial intelligence implementation",
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
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
