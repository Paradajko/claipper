import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claipper — Menej hľadania. Viac strihania.",
  description: "6 hodín videa, 10 navrhnutých momentov ráno. AI nájde, ty striháš. Pre klipperov, čo vedia čo robia.",
  openGraph: {
    title: "Claipper — Menej hľadania. Viac strihania.",
    description: "6 hodín videa, 10 navrhnutých momentov ráno. AI nájde, ty striháš.",
    type: "website",
    url: "https://claipper.com/sk",
    siteName: "Claipper",
    images: [{ url: "/images/og-claipper.png", width: 1200, height: 630, alt: "Claipper dashboard preview" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Claipper — Menej hľadania. Viac strihania.",
    description: "6 hodín videa, 10 navrhnutých momentov ráno. AI nájde, ty striháš.",
    images: ["/images/og-claipper.png"]
  },
  alternates: {
    canonical: "https://claipper.com/sk",
    languages: {
      en: "https://claipper.com",
      sk: "https://claipper.com/sk",
      "x-default": "https://claipper.com"
    }
  }
};

export default function SlovakLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
