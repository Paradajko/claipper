"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const VIDEOS = [
  "/clips/streamer.mp4",
  "/clips/motivator.mp4",
  "/clips/podcast.mp4"
] as const;

export default function HeroPhone({ activeIndex }: { activeIndex: number }) {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

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
    <div className="relative mx-auto w-full max-w-[280px] shrink-0 md:max-w-[300px]">
      <div className="absolute -inset-3 rounded-[2rem] bg-emerald-400/20 blur-2xl" />

      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.65rem] border border-emerald-400/20 bg-black shadow-[0_30px_70px_-20px_rgba(0,0,0,0.85)]">
        {VIDEOS.map((src, index) => (
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
            aria-label={`Demo clip ${index + 1}`}
            className="absolute inset-0 h-full w-full object-cover"
            initial={false}
            animate={{ opacity: index === activeIndex ? 1 : 0 }}
            transition={{ duration: 0.55 }}
          />
        ))}
        <motion.div
          key={activeIndex}
          className="pointer-events-none absolute inset-y-0 w-px bg-emerald-300/80 shadow-[0_0_26px_rgba(16,185,129,.85)]"
          initial={{ left: "0%", opacity: 0 }}
          animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
          transition={{ duration: 5.6, ease: "linear" }}
        />
        <motion.div
          key={`wash-${activeIndex}`}
          className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-emerald-300/10 to-transparent"
          initial={{ left: "-20%" }}
          animate={{ left: "100%" }}
          transition={{ duration: 5.6, ease: "linear" }}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3">
        <div className="flex items-center justify-between gap-3 font-mono text-[10px] text-slate-500">
          <span>00:00</span>
          <div className="relative h-4 flex-1">
            <div className="absolute left-0 top-[8px] h-px w-full -translate-y-1/2 bg-slate-700" />
            {[18, 43, 58, 82].map((position, index) => (
              <motion.span
                key={`${activeIndex}-${position}`}
                className="absolute top-[5px] z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-950 bg-emerald-400 shadow-[0_0_16px_rgba(16,185,129,.8)]"
                style={{ left: `${position}%` }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: [0.4, 1.35, 1] }}
                transition={{ delay: 0.55 + index * 0.62, duration: 0.42, ease: "easeOut" }}
              />
            ))}
            <motion.div
              key={`progress-${activeIndex}`}
              className="absolute left-0 top-[8px] z-20 h-px -translate-y-1/2 bg-emerald-400/70"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 5.6, ease: "linear" }}
            />
          </div>
          <span>60:00</span>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {VIDEOS.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === activeIndex ? "bg-emerald-400" : "bg-white/30"
            } ${index === activeIndex ? "w-6" : "w-3"}`}
          />
        ))}
      </div>
    </div>
  );
}
