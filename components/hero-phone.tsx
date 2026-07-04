"use client";

import { motion } from "framer-motion";

const VIDEOS = [
  "/clips/streamer.mp4",
  "/clips/motivator.mp4",
  "/clips/podcast.mp4"
] as const;

export default function HeroPhone({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="relative mx-auto">
      <div className="absolute -inset-4 rounded-[3rem] bg-emerald-400/20 blur-2xl" />

      <div className="relative mx-auto aspect-[9/16] max-w-[260px] rounded-[2.5rem] border-2 border-slate-800 bg-slate-900 p-2 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] md:max-w-[300px]">
        <div className="absolute left-1/2 top-0 z-20 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-slate-950" />

        <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-black">
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
              transition={{ duration: 0.5 }}
            />
          ))}
        </div>
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
