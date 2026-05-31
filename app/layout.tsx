import type { Metadata } from "next";
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
    default: "SiteTech AI | AI for the real world of real estate",
    template: "%s | SiteTech AI",
  },
  description:
    "SiteTech AI deploys forward-deployed AI engineers to build custom, governed AI workflows for real estate development, construction, brokerages, appraisal, and private equity.",
  keywords: [
    "AI for real estate",
    "construction AI",
    "real estate development AI",
    "AI implementation company",
    "forward deployed engineers",
    "real estate private equity AI",
    "real estate appraisal AI",
    "Procore AI integration",
    "custom AI workflows",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SiteTech AI | AI for the real world of real estate",
    description:
      "Custom, governed AI workflows for real estate and construction, built and maintained by forward-deployed AI engineers.",
    url: siteUrl,
    siteName: "SiteTech AI",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SiteTech AI | AI for the real world of real estate",
    description:
      "Custom, governed AI workflows for real estate and construction, built and maintained by forward-deployed AI engineers.",
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

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SiteTech AI",
  url: siteUrl,
  description:
    "AI implementation company that builds custom, governed AI workflows for real estate development, construction, brokerages, appraisal, and private equity.",
  logo: `${siteUrl}/icon.png`,
  areaServed: "US",
  knowsAbout: [
    "Real estate development",
    "Construction",
    "Real estate brokerage",
    "Real estate appraisal",
    "Real estate private equity",
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
