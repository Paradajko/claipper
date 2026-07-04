import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://claipper.com"),
  title: "Claipper — Less scrubbing. More shipping.",
  description: "6 hours of footage, 10 ranked clip ideas by morning. AI finds the moments. You cut the keepers.",
  openGraph: {
    title: "Claipper — Less scrubbing. More shipping.",
    description: "6 hours of footage, 10 ranked clip ideas by morning. AI finds the moments. You cut the keepers.",
    type: "website",
    url: "https://claipper.com",
    siteName: "Claipper",
    images: [{ url: "/images/og-claipper.png", width: 1200, height: 630, alt: "Claipper dashboard preview" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Claipper — Less scrubbing. More shipping.",
    description: "6 hours of footage, 10 ranked clip ideas by morning. AI finds the moments. You cut the keepers.",
    images: ["/images/og-claipper.png"]
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  },
  alternates: {
    canonical: "https://claipper.com",
    languages: {
      en: "https://claipper.com",
      "x-default": "https://claipper.com"
    }
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
