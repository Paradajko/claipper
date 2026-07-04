"use client";

import { motion } from "framer-motion";

const VIDEOS = [
  "/clips/streamer.mp4",
  "/clips/motivator.mp4",
  "/clips/podcast.mp4"
] as const;

export default function HeroPhone({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="relative mx-auto w-full max-w-[300px] shrink-0 md:max-w-[330px]">
      <div className="absolute -inset-3 rounded-[2rem] bg-emerald-400/20 blur-2xl" />

      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.65rem] border border-emerald-400/20 bg-black shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)]">
        {VIDEOS.map((src, index) => (
          <motion.video
            key={src}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            aria-label={`Demo clip ${index + 1}`}
            className="absolute inset-0 h-full w-full object-cover"
            initial={false}
            animate={{ opacity: index === activeIndex ? 1 : 0 }}
            transition={{ duration: 0.55 }}
          />
        ))}
      </div>

      <div className="absolute -bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-2">
        {VIDEOS.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
              index === activeIndex ? "bg-emerald-400" : "bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
