"use client";

import { motion } from "framer-motion";

const MOMENTS_BY_INDEX = [
  [
    { time: "00:14:32 – 00:15:08", label: "Unexpected fail moment", score: 91, status: "Ready to clip" },
    { time: "00:27:10 – 00:27:44", label: "Funny reaction", score: 84, status: "Hook ready" },
    { time: "00:41:02 – 00:41:39", label: "Replay-worthy beat", score: 88, status: "Caption ready" }
  ],
  [
    { time: "00:08:14 – 00:08:49", label: "Strong statement", score: 92, status: "Ready to clip" },
    { time: "00:19:35 – 00:20:04", label: "Mindset hook", score: 86, status: "Hook ready" },
    { time: "00:38:20 – 00:38:52", label: "High save potential", score: 89, status: "Caption ready" }
  ],
  [
    { time: "00:11:06 – 00:11:41", label: "Sharp answer", score: 90, status: "Ready to clip" },
    { time: "00:26:18 – 00:26:55", label: "Contrarian quote", score: 85, status: "Hook ready" },
    { time: "00:44:03 – 00:44:38", label: "High retention moment", score: 88, status: "Caption ready" }
  ]
] as const;

const CLIP_CARDS = [
  { title: "When the stream goes sideways", time: "00:14:32", platform: "TT" },
  { title: "The mindset line that lands", time: "00:08:14", platform: "YT" },
  { title: "One answer worth clipping", time: "00:11:06", platform: "IG" }
] as const;

const PROCESS_STEPS = ["Raw footage", "Moments detected", "Clip ideas", "Ready to edit"] as const;

export default function AiScannerPanel({ activeIndex }: { activeIndex: number }) {
  const moments = MOMENTS_BY_INDEX[activeIndex] ?? MOMENTS_BY_INDEX[0];
  const clipCard = CLIP_CARDS[activeIndex] ?? CLIP_CARDS[0];

  return (
    <div className="hidden h-[500px] w-[340px] shrink-0 flex-col overflow-hidden rounded-[1.35rem] border border-emerald-400/20 bg-slate-950/75 p-3.5 backdrop-blur-md md:flex">
      <div className="mb-3 grid gap-1.5 rounded-2xl border border-white/10 bg-white/[0.025] p-2.5">
        {PROCESS_STEPS.map((step, index) => (
          <motion.div
            key={`${activeIndex}-${step}`}
            className="flex items-center gap-2 text-[11px] text-slate-400"
            initial={{ opacity: 0.45 }}
            animate={{ opacity: index <= 3 ? 1 : 0.45 }}
            transition={{ delay: index * 0.35, duration: 0.3 }}
          >
            <motion.span
              className="h-2 w-2 rounded-full bg-emerald-400"
              initial={{ boxShadow: "0 0 0 rgba(16,185,129,0)" }}
              animate={{ boxShadow: ["0 0 0 rgba(16,185,129,0)", "0 0 18px rgba(16,185,129,.75)", "0 0 8px rgba(16,185,129,.35)"] }}
              transition={{ delay: index * 0.35, duration: 0.7 }}
            />
            <span>{step}</span>
          </motion.div>
        ))}
      </div>

      <div className="space-y-2">
        {moments.map((moment, index) => (
          <motion.div
            key={`${activeIndex}-${moment.time}`}
            className="rounded-xl border border-white/10 bg-white/[0.035] p-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.55, duration: 0.35, ease: "easeOut" }}
          >
            <div className="font-mono text-[10px] text-slate-500">{moment.time}</div>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <p className="truncate text-[13px] font-medium text-white">{moment.label}</p>
              <span className="font-mono text-xs text-emerald-300">{moment.score}%</span>
            </div>
            <div className="mt-1.5 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
              {moment.status}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        key={`clip-${activeIndex}`}
        className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.25, duration: 0.4, ease: "easeOut" }}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Clip idea</span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">{clipCard.platform}</span>
        </div>
        <p className="text-[13px] font-semibold leading-5 text-white">{clipCard.title}</p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-mono text-slate-500">{clipCard.time}</span>
          <span className="rounded-full bg-emerald-400 px-2.5 py-1 font-semibold text-slate-950">Ready</span>
        </div>
      </motion.div>
    </div>
  );
}
