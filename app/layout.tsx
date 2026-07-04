import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Claipper",
  description: "Interný clipping production workspace pre MyLaura kampane."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
