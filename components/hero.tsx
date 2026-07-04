"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import HeroPhone from "@/components/hero-phone";
import LiveChat from "@/components/live-chat";

type HeroCopy = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
};

const defaultCopy: HeroCopy = {
  badge: "Clipping production workspace",
  title: "You don't need to watch it all.",
  subtitle:
    "Claipper helps clippers scan long videos, find strong moments, generate hooks, and move from raw footage to ready-to-edit clips faster.",
  primaryCta: "Get Clips",
  secondaryCta: "See how it works"
};

const INITIAL_LIKES = [12431, 8247, 24182];

export default function Hero({ copy = defaultCopy, onPrimaryCta }: { copy?: HeroCopy; onPrimaryCta?: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [likesCount, setLikesCount] = useState(INITIAL_LIKES[0]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((previous) => {
        const next = (previous + 1) % INITIAL_LIKES.length;
        setLikesCount(INITIAL_LIKES[next]);
        return next;
      });
    }, 4500);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLikesCount((previous) => previous + Math.floor(Math.random() * 3 + 1));
    }, 1800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="mx-auto grid min-h-[calc(100vh-82px)] max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="max-w-2xl">
        <span className="mb-5 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
          {copy.badge}
        </span>
        <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
          {copy.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{copy.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {onPrimaryCta ? (
            <button
              type="button"
              onClick={onPrimaryCta}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              {copy.primaryCta}
              <ArrowRight size={17} />
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              {copy.primaryCta}
              <ArrowRight size={17} />
            </Link>
          )}
          <Link
            href="#ako-to-funguje"
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:border-emerald-400/40 hover:bg-emerald-400/10"
          >
            {copy.secondaryCta}
          </Link>
        </div>
      </div>

      <div className="relative isolate flex items-center justify-center gap-6 lg:justify-end">
        <HeroPhone activeIndex={activeIndex} />
        <LiveChat activeIndex={activeIndex} likesCount={likesCount} />
      </div>
    </section>
  );
}
