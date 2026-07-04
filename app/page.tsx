import type { Metadata } from "next";
import LandingClient from "@/components/landing-client";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://claipper.com",
    languages: {
      en: "https://claipper.com",
      sk: "https://claipper.com/sk",
      "x-default": "https://claipper.com"
    }
  }
};

export default function LandingPage() {
  return <LandingClient locale="en" />;
}
