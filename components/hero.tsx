"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import AiScannerPanel from "@/components/ai-scanner-panel";
import HeroPhone from "@/components/hero-phone";

type HeroCopy = {
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
};

const defaultCopy: HeroCopy = {
  title: "You don't need to watch it all.",
  subtitle:
    "Find the best moments in long videos without watching the whole thing",
  primaryCta: "Find Moments",
  secondaryCta: "See Workflow"
};

const CLIP_COUNT = 3;
const HERO_VIDEOS = [
  "/clips/streamer.mp4",
  "/clips/motivator.mp4",
  "/clips/podcast.mp4"
] as const;

const MOBILE_MOMENTS_BY_INDEX = [
  [
    { time: "00:14:32", label: "Unexpected fail moment", score: 91, status: "Ready to clip" },
    { time: "00:27:10", label: "Funny reaction", score: 84, status: "Hook ready" }
  ],
  [
    { time: "00:08:14", label: "Strong statement", score: 92, status: "Ready to clip" },
    { time: "00:19:35", label: "Mindset hook", score: 86, status: "Hook ready" }
  ],
  [
    { time: "00:11:06", label: "Sharp answer", score: 90, status: "Ready to clip" },
    { time: "00:26:18", label: "Contrarian quote", score: 85, status: "Hook ready" }
  ]
] as const;

const MOBILE_CLIP_CARDS = [
  { title: "When the stream goes sideways", time: "00:14:32", platform: "TT" },
  { title: "The mindset line that lands", time: "00:08:14", platform: "YT" },
  { title: "One answer worth clipping", time: "00:11:06", platform: "IG" }
] as const;

function MobileHeroVisual({ activeIndex }: { activeIndex: number }) {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const moments = MOBILE_MOMENTS_BY_INDEX[activeIndex] ?? MOBILE_MOMENTS_BY_INDEX[0];
  const clipCard = MOBILE_CLIP_CARDS[activeIndex] ?? MOBILE_CLIP_CARDS[0];
  const mobileTimelineDots = [24, 58, 82] as const;

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;

      video.currentTime = 0;
      if (index === activeIndex) {
        void video.play();
      } else {
        video.pause();
      }
    });
  }, [activeIndex]);

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-emerald-400/15 bg-slate-950/75 p-3 shadow-[0_24px_80px_-45px_rgba(16,185,129,.7)] md:hidden">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="relative grid grid-cols-[0.92fr_1fr] gap-3">
        <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-emerald-400/20 bg-black">
          {HERO_VIDEOS.map((src, index) => (
            <motion.video
              key={src}
              ref={(element) => {
                videoRefs.current[index] = element;
              }}
              src={src}
              autoPlay={index === activeIndex}
              muted
              loop
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-cover"
              initial={false}
              animate={{ opacity: index === activeIndex ? 1 : 0 }}
              transition={{ duration: 0.55 }}
            />
          ))}
          <motion.div
            key={`mobile-scan-${activeIndex}`}
            className="pointer-events-none absolute inset-y-0 w-px bg-emerald-300/80 shadow-[0_0_22px_rgba(16,185,129,.85)]"
            initial={{ left: "0%", opacity: 0 }}
            animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
            transition={{ duration: 5.6, ease: "linear" }}
          />
          <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/45 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
            Draft preview
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          {moments.map((moment, index) => (
            <motion.div
              key={`${activeIndex}-${moment.time}`}
              className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.55, duration: 0.35, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-slate-500">{moment.time}</span>
                <span className="text-[10px] font-semibold text-emerald-300">{moment.score}%</span>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-white">{moment.label}</p>
              <span className="mt-2 inline-flex rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                {moment.status}
              </span>
            </motion.div>
          ))}
          <motion.div
            key={`mobile-clip-${activeIndex}`}
            className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] p-2.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7, duration: 0.35, ease: "easeOut" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Clip idea</p>
            <p className="mt-1 text-xs font-semibold leading-4 text-white">{clipCard.title}</p>
            <p className="mt-1 font-mono text-[10px] text-slate-500">{clipCard.time} · {clipCard.platform}</p>
          </motion.div>
        </div>
      </div>
      <div className="relative mt-3 h-4">
        <div className="absolute left-0 top-[8px] h-px w-full -translate-y-1/2 rounded-full bg-slate-700" />
        {mobileTimelineDots.map((left, index) => (
          <motion.span
            key={`${activeIndex}-${left}`}
            className="absolute top-[8px] z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-950 bg-emerald-400 shadow-[0_0_16px_rgba(16,185,129,.8)]"
            style={{ left: `${left}%` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: [0.4, 1.25, 1] }}
            transition={{ delay: 0.55 + index * 0.62, duration: 0.42, ease: "easeOut" }}
          />
        ))}
        <motion.div
          key={`mobile-progress-${activeIndex}`}
          className="absolute left-0 top-[8px] z-10 h-px -translate-y-1/2 rounded-full bg-emerald-400/70"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 5.6, ease: "linear" }}
        />
      </div>
    </div>
  );
}

export default function Hero({ copy = defaultCopy, onPrimaryCta }: { copy?: HeroCopy; onPrimaryCta?: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % CLIP_COUNT);
    }, 6000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-6 sm:px-6 md:min-h-[calc(100vh-82px)] md:gap-10 md:pt-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
      <div className="max-w-2xl">
        <h1 className="max-w-4xl text-[2.08rem] font-semibold leading-[0.98] tracking-tight text-white min-[430px]:text-[2.76rem] sm:text-6xl sm:leading-[1.04] lg:text-7xl">
          You <span className="text-emerald-400">don&apos;t</span> need to <span className="text-emerald-400">watch</span> it all.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:mt-6 sm:text-lg sm:leading-8">{copy.subtitle}</p>
        <div className="mt-7 grid gap-3 min-[430px]:grid-cols-2 sm:mt-8 sm:flex sm:flex-wrap">
          {onPrimaryCta ? (
            <button
              type="button"
              onClick={onPrimaryCta}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-300 via-emerald-400 to-green-400 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_34px_rgba(16,185,129,.32)] transition hover:-translate-y-0.5 hover:shadow-[0_0_42px_rgba(16,185,129,.34)]"
            >
              {copy.primaryCta}
              <ArrowRight size={17} />
            </button>
          ) : (
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-300 via-emerald-400 to-green-400 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_34px_rgba(16,185,129,.32)] transition hover:-translate-y-0.5 hover:shadow-[0_0_42px_rgba(16,185,129,.34)]"
            >
              {copy.primaryCta}
              <ArrowRight size={17} />
            </Link>
          )}
          <Link
            href="#how-it-works"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-white/15 bg-slate-950/35 px-6 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition hover:border-emerald-300/45 hover:bg-emerald-400/10 hover:shadow-[0_0_28px_rgba(16,185,129,.16)]"
          >
            {copy.secondaryCta}
          </Link>
        </div>
      </div>

      <MobileHeroVisual activeIndex={activeIndex} />

      <div className="relative isolate mx-auto hidden md:block w-full max-w-[820px] lg:mr-0">
        <div className="absolute -inset-6 rounded-[2.25rem] bg-emerald-400/10 blur-3xl" />
        <div className="relative overflow-hidden rounded-[2rem] border border-emerald-400/15 bg-slate-950/70 p-4 shadow-[0_34px_110px_-34px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-5">
          <div className="flex items-center justify-center gap-5">
            <HeroPhone activeIndex={activeIndex} />
            <AiScannerPanel activeIndex={activeIndex} />
          </div>
        </div>
      </div>
    </section>
  );
}
