import type { Metadata } from "next";
import LandingClient from "@/components/landing-client";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://claipper.com",
    languages: {
      en: "https://claipper.com",
      "x-default": "https://claipper.com"
    }
  }
};

export default function LandingPage() {
  return <LandingClient />;
}
