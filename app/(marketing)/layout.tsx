import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";

const siteUrl = "https://sitetech.ai";

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

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Header />
      {children}
      <Footer />
    </>
  );
}
