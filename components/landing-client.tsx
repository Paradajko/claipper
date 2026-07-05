"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Gauge,
  Link2,
  MousePointer2,
  PenLine,
  Sparkles,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Hero from "@/components/hero";
import { Card } from "@/components/ui";

const workflow = [
  { icon: Sparkles, title: "Scan the footage", text: "Find strong moments inside long-form content without manually scrubbing through hours of video." },
  { icon: FileText, title: "Create clip drafts", text: "Turn selected moments into ready-to-review clip drafts with timestamps, hooks and captions." },
  { icon: PenLine, title: "Shape the angle", text: "Adjust the hook, caption, CTA, subtitle notes and edit direction before production." },
  { icon: BarChart3, title: "Track performance", text: "Keep scheduled posts, published links and performance notes in one workflow." }
];

const connectedClipVideos = ["/clips/streamer.mp4", "/clips/motivator.mp4", "/clips/podcast.mp4"] as const;
const workflowStepNumbers = ["01", "02", "03", "04"] as const;

const heroCopy = {
  title: "You don't need to watch it all.",
  subtitle: "Find the best moments in long videos without watching the whole thing",
  primaryCta: "Find Moments",
  secondaryCta: "See Workflow"
} as const;

function LandingSection({
  eyebrow,
  title,
  subtitle,
  children,
  className = ""
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative border-t border-white/10 ${className}`}>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(148,163,184,.035)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-70" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-3xl">
          {eyebrow ? <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">{eyebrow}</p> : null}
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <Card className="neon-line h-full">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 shadow-[0_0_24px_rgba(16,185,129,.14)]">
        <Icon className="h-5 w-5 text-emerald-300" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-6 text-slate-300">{text}</p>
    </Card>
  );
}

function ProductPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-emerald-300/10 bg-slate-950/70 shadow-[0_30px_110px_-48px_rgba(16,185,129,.55)] ${className}`}>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,.04)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.035)_1px,transparent_1px)] bg-[size:34px_34px] opacity-70" />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

function CalculatorMockup() {
  const [videosPerWeek, setVideosPerWeek] = useState(8);
  const [reviewMinutesPerVideo, setReviewMinutesPerVideo] = useState(90);

  const calculatorResult = useMemo(() => {
    const manualMonthlyHours = (videosPerWeek * reviewMinutesPerVideo * 4) / 60;
    const claipperMonthlyHours = manualMonthlyHours * 0.3;
    const savedMonthlyHours = Math.round(manualMonthlyHours - claipperMonthlyHours);
    const draftsPreparedPerMonth = videosPerWeek * 4;
    const momentsReviewedPerMonth = videosPerWeek * 4 * 3;

    return {
      manualMonthlyHours,
      claipperMonthlyHours,
      savedMonthlyHours,
      draftsPreparedPerMonth,
      momentsReviewedPerMonth
    };
  }, [reviewMinutesPerVideo, videosPerWeek]);

  const manualMonthlyDisplay = Math.round(calculatorResult.manualMonthlyHours);
  const claipperMonthlyDisplay = Math.round(calculatorResult.claipperMonthlyHours);
  const savedBarWidth = Math.round(((calculatorResult.manualMonthlyHours - calculatorResult.claipperMonthlyHours) / calculatorResult.manualMonthlyHours) * 100);
  const claipperBarWidth = Math.round((calculatorResult.claipperMonthlyHours / calculatorResult.manualMonthlyHours) * 100);

  const controls = [
    {
      label: "How many videos per week?",
      displayLabel: "Videos per week",
      value: videosPerWeek,
      suffix: "",
      min: 1,
      max: 20,
      onChange: setVideosPerWeek
    },
    {
      label: "Review time per video",
      displayLabel: "Review time per video",
      value: reviewMinutesPerVideo,
      suffix: "min",
      min: 15,
      max: 180,
      onChange: setReviewMinutesPerVideo
    }
  ];
  const reviewBreakdown = [
    { label: "Scrubbing footage", value: 60 },
    { label: "Writing timestamps", value: 25 },
    { label: "First hook pass", value: 15 }
  ];

  return (
    <ProductPanel className="p-4 sm:p-7 lg:p-8">
      <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <div className="order-1 rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">Interactive calculator</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Tune your weekly review load</h3>
            </div>
            <span className="hidden rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200 sm:inline-flex">
              Live estimate
            </span>
          </div>

          <div className="space-y-7">
            {controls.map((control, index) => {
              const progress = ((control.value - control.min) / (control.max - control.min)) * 100;

              return (
                <div key={control.label}>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-slate-200" htmlFor={`calculator-${index}`}>
                      {control.displayLabel}
                    </label>
                    <span className="min-w-20 rounded-md border border-emerald-300/15 bg-emerald-300/[0.08] px-3 py-1 text-right text-sm font-semibold text-emerald-100">
                      {control.value}
                      {control.suffix ? ` ${control.suffix}` : ""}
                    </span>
                  </div>
                  <input
                    id={`calculator-${index}`}
                    type="range"
                    min={control.min}
                    max={control.max}
                    value={control.value}
                    onChange={(event) => control.onChange(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-emerald-300"
                    style={{
                      background: `linear-gradient(90deg, rgb(110 231 183) 0%, rgb(16 185 129) ${progress}%, rgb(30 41 59) ${progress}%, rgb(30 41 59) 100%)`,
                      boxShadow: "0 0 28px rgba(16,185,129,.18)"
                    }}
                    aria-label={control.label}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-8 hidden rounded-2xl border border-emerald-300/10 bg-slate-950/58 p-4 shadow-[0_22px_70px_-48px_rgba(16,185,129,.65)] lg:block">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-white">Review workload breakdown</h4>
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,.8)]" />
            </div>
            <div className="space-y-3">
              {reviewBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-300">{item.label}</span>
                    <span className="font-semibold text-emerald-100">{item.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800/85">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-300/70 to-green-400"
                      initial={false}
                      animate={{ width: `${item.value}%` }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">Claipper reduces the slow review layer before the creative edit starts.</p>
          </div>
        </div>

        <div className="order-2 relative overflow-hidden rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,.24),transparent_18rem),rgba(16,185,129,.055)] p-4 shadow-[0_30px_100px_-50px_rgba(16,185,129,.9)] sm:p-6">
          <motion.div
            className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent"
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200/80">Monthly review estimate</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <motion.div
                key={`manual-${manualMonthlyDisplay}`}
                initial={{ opacity: 0.6, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl bg-white/[0.035] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Manual review</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">{manualMonthlyDisplay}h <span className="text-sm font-medium text-slate-400">/ month</span></p>
              </motion.div>
              <motion.div
                key={`claipper-${claipperMonthlyDisplay}`}
                initial={{ opacity: 0.6, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl bg-emerald-300/[0.06] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">With Claipper</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-100">{claipperMonthlyDisplay}h <span className="text-sm font-medium text-emerald-200/70">/ month</span></p>
              </motion.div>
            </div>
            <motion.div
              key={calculatorResult.savedMonthlyHours}
              initial={{ opacity: 0.65, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-5 shadow-[0_0_58px_rgba(16,185,129,.18)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">Time saved</p>
              <span className="mt-2 inline-block text-5xl font-semibold tracking-tight text-white sm:text-7xl">{calculatorResult.savedMonthlyHours}h</span>
              <span className="ml-2 text-xl font-semibold text-emerald-200">/ month</span>
            </motion.div>
            <div className="mt-5 hidden space-y-3 md:block">
              {[
                { label: "Manual review", width: 100, className: "bg-slate-600" },
                { label: "Claipper review", width: claipperBarWidth, className: "bg-emerald-400" },
                { label: "Saved time", width: savedBarWidth, className: "bg-gradient-to-r from-emerald-300 to-green-400" }
              ].map((bar) => (
                <div key={bar.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-400">
                    <span>{bar.label}</span>
                    <span>{bar.width}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-800/80">
                    <motion.div
                      className={`h-full rounded-full ${bar.className}`}
                      animate={{ width: `${bar.width}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 hidden text-sm leading-6 text-slate-300 md:block">Estimated from reducing manual review time by roughly 70%. Actual results depend on video type and review depth.</p>

            <div className="mt-5 hidden gap-3 md:grid sm:grid-cols-3">
              {[
                { label: "draft clips prepared", value: calculatorResult.draftsPreparedPerMonth },
                { label: "moments reviewed", value: calculatorResult.momentsReviewedPerMonth },
                { label: "faster review", value: "3.3x" }
              ].map((metric) => (
                <div key={metric.label} className="rounded-xl bg-slate-950/58 p-3">
                  {metric.label === "faster review" ? <span className="sr-only">3.3x faster review</span> : null}
                  <motion.p
                    key={`${metric.label}-${metric.value}`}
                    initial={{ opacity: 0.6, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-xl font-semibold text-white"
                  >
                    {metric.value} <span className="block text-xs font-medium leading-5 text-slate-300">{metric.label}</span>
                  </motion.p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="order-3 hidden rounded-2xl border border-emerald-300/10 bg-slate-950/58 p-4 shadow-[0_22px_70px_-48px_rgba(16,185,129,.65)] md:block lg:hidden">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-white">Review workload breakdown</h4>
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,.8)]" />
          </div>
          <div className="space-y-3">
            {reviewBreakdown.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-slate-300">{item.label}</span>
                  <span className="font-semibold text-emerald-100">{item.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800/85">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300/70 to-green-400"
                    initial={false}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">Claipper reduces the slow review layer before the creative edit starts.</p>
        </div>
      </div>
    </ProductPanel>
  );
}

function ClaipperClipVisual() {
  return (
    <div className="relative mb-4 flex h-52 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,.16),transparent_24rem),linear-gradient(180deg,rgba(15,23,42,.4),rgba(2,6,23,.94))] px-3 py-5 sm:mb-5 sm:h-80 sm:px-6 sm:py-8">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,.06)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.05)_1px,transparent_1px)] bg-[size:38px_38px] opacity-70" />
      <div className="relative z-10 flex w-full flex-col justify-center gap-4 sm:gap-10">
        <div>
          <p className="mb-3 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/70 sm:mb-5 sm:text-xs sm:tracking-[0.2em]">Long video becomes short clips</p>
          <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-500 sm:gap-3 sm:text-[11px]">
            <span>00:00</span>
            <div className="relative h-3 flex-1">
              <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-slate-800" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
              <motion.span
                className="absolute top-1/2 h-6 w-10 -translate-y-1/2 rounded-full bg-emerald-300/20 blur-md sm:h-9 sm:w-16"
                animate={{ left: ["0%", "88%", "0%"] }}
                transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
              />
              {[24, 56, 76].map((left, index) => (
                <motion.span
                  key={left}
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-100/70 bg-emerald-300 shadow-[0_0_22px_rgba(16,185,129,.85)] sm:h-4 sm:w-4"
                  style={{ left: `${left}%` }}
                  animate={{ scale: [0.9, 1.22, 0.9], opacity: [0.65, 1, 0.65] }}
                  transition={{ delay: index * 0.35, duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </div>
            <span>60:00</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {connectedClipVideos.map((src, index) => (
            <motion.div
              key={src}
              className="relative mx-auto aspect-[9/14] w-full max-w-[4.2rem] overflow-hidden rounded-lg border border-emerald-300/15 bg-slate-950 shadow-[0_18px_45px_-24px_rgba(16,185,129,.7)] min-[430px]:max-w-[4.8rem] sm:max-w-[5.8rem] sm:rounded-xl"
              initial={false}
              animate={{ opacity: [0.45, 1, 1, 0.45], y: [12, 0, 0, 12] }}
              transition={{ delay: 0.7 + index * 0.28, duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <video src={src} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" aria-label={`Connected workflow clip ${index + 1}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/20" />
              <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                <span className="hidden rounded-full bg-emerald-300/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200 min-[430px]:inline-flex">Ready</span>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-300 text-slate-950 sm:h-5 sm:w-5">
                  <Check className="h-3 w-3" />
                </span>
              </div>
              <span className="absolute bottom-2 left-2 text-[8px] font-semibold text-white/80 sm:bottom-3 sm:left-3 sm:text-[10px]">Clip 0{index + 1}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConnectionPill({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex min-w-44 items-center gap-3 overflow-hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-[0_0_32px_rgba(16,185,129,.12)] ${className}`}>
      <motion.span
        className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent"
        animate={{ x: [-64, 220] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute inset-0 rounded-full border border-emerald-300/20"
        animate={{ opacity: [0.25, 0.7, 0.25], boxShadow: ["0 0 0 rgba(16,185,129,0)", "0 0 26px rgba(16,185,129,.22)", "0 0 0 rgba(16,185,129,0)"] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span>Swipe from context</span>
      <ArrowRight className="h-4 w-4" />
      <span>to clips</span>
    </div>
  );
}

function MyLauraCard() {
  return (
    <div className="h-full overflow-hidden rounded-2xl border border-emerald-400/15 bg-slate-950/70 p-4 shadow-[0_24px_80px_-35px_rgba(0,0,0,.95)] sm:p-5">
      <div className="relative mb-4 flex h-52 items-end justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-emerald-400/10 via-slate-950/20 to-slate-950 sm:mb-5 sm:h-80">
        <div className="absolute inset-x-8 bottom-0 h-36 rounded-full bg-emerald-400/15 blur-3xl" />
        <Image
          src="/images/laura-mylaura.png"
          alt="Laura, MyLaura campaign intelligence visual"
          width={1735}
          height={2643}
          priority={false}
          sizes="(min-width: 1024px) 430px, 84vw"
          className="relative z-10 h-full w-auto object-contain object-bottom"
        />
      </div>
      <div className="flex h-14 items-center justify-start sm:h-20">
        <Image
          src="/images/my-laura-logo-dark-bg.png"
          alt="MyLaura"
          width={577}
          height={176}
          sizes="260px"
          className="h-auto w-[min(210px,100%)] object-contain object-left sm:w-[min(260px,100%)]"
        />
      </div>
      <h3 className="mt-2 text-xl font-semibold leading-6 text-white sm:text-2xl">Campaign intelligence</h3>
      <ul className="mt-5 grid gap-2.5 text-sm text-slate-300 sm:mt-6 sm:gap-3">
        {[
          ["campaign briefs", FileText],
          ["creator context", UserRound],
          ["scoring", Gauge],
          ["performance insights", BarChart3]
        ].map(([label, Icon]) => (
          <li key={label as string} className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-emerald-300" />
            <span>{label as string}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClaipperCard() {
  return (
    <div className="h-full overflow-hidden rounded-2xl border border-emerald-400/15 bg-slate-950/70 p-4 shadow-[0_24px_80px_-35px_rgba(0,0,0,.95)] sm:p-5">
      <ClaipperClipVisual />
      <div className="flex h-14 items-center justify-start sm:h-20">
        <Image
          src="/images/claipper-logo.svg"
          alt="Claipper"
          width={900}
          height={220}
          sizes="330px"
          className="h-auto w-[min(230px,100%)] object-contain object-left sm:w-[min(330px,100%)]"
        />
      </div>
      <h3 className="mt-2 text-xl font-semibold leading-6 text-white sm:text-2xl">Clip production workspace</h3>
      <ul className="mt-5 grid gap-2.5 text-sm text-slate-300 sm:mt-6 sm:gap-3">
        {[
          ["moment scanning", Sparkles],
          ["clip ideas", MousePointer2],
          ["hooks & captions", FileText],
          ["ready-to-edit outputs", Check]
        ].map(([label, Icon]) => (
          <li key={label as string} className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-emerald-300" />
            <span>{label as string}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LandingClient() {
  const myLauraCarouselRef = useRef<HTMLDivElement | null>(null);
  const [myLauraSlide, setMyLauraSlide] = useState<"context" | "clips">("context");

  function handleMyLauraCarouselScroll() {
    const carousel = myLauraCarouselRef.current;
    if (!carousel) return;

    setMyLauraSlide(carousel.scrollLeft > carousel.clientWidth * 0.42 ? "clips" : "context");
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-mask opacity-80" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/images/claipper-logo.svg"
            alt="Claipper"
            width={900}
            height={220}
            priority
            className="h-11 w-auto max-w-[180px] object-contain sm:h-16 sm:max-w-[230px]"
          />
        </Link>
        <Link
          href="/app"
          className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-400/35 bg-emerald-400/[0.06] px-2.5 text-[13px] font-semibold text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,.12)] md:hidden"
        >
          Open App
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <a href="#how-it-works" className="transition hover:text-white">How it works</a>
          <a href="#mylaura" className="transition hover:text-white">MyLaura x Claipper</a>
          <Link
            href="/app"
            className="rounded-md border border-emerald-400/35 bg-emerald-400/[0.04] px-4 py-2 text-sm font-semibold text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,.12)] transition hover:border-emerald-300/60 hover:bg-emerald-400/10 hover:shadow-[0_0_28px_rgba(16,185,129,.2)]"
          >
            Open App
          </Link>
        </nav>
      </header>

      <Hero copy={heroCopy} />

      <section id="mylaura" className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Connected workflow</p>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">MyLaura x Claipper</h2>
            <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Laura plans the campaign. Claipper gets the clips ready.
            </p>
          </div>

          <div className="lg:hidden">
            <div className="mb-4 flex justify-center">
              <ConnectionPill />
            </div>
            <div className="mb-4 text-center">
              <motion.p
                key={myLauraSlide}
                className="text-3xl font-semibold uppercase tracking-[0.18em] text-emerald-300 drop-shadow-[0_0_22px_rgba(16,185,129,.45)]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {myLauraSlide === "context" ? "CONTEXT" : "CLIPS"}
              </motion.p>
            </div>
            <div
              ref={myLauraCarouselRef}
              onScroll={handleMyLauraCarouselScroll}
              className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="min-w-[84vw] snap-start">
                <MyLauraCard />
              </div>
              <div className="min-w-[84vw] snap-start">
                <ClaipperCard />
              </div>
            </div>
            <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
              <span className={`h-1.5 rounded-full transition-all duration-300 ${myLauraSlide === "context" ? "w-7 bg-emerald-300 shadow-[0_0_14px_rgba(16,185,129,.65)]" : "w-1.5 bg-emerald-300/35"}`} />
              <span className={`h-1.5 rounded-full transition-all duration-300 ${myLauraSlide === "clips" ? "w-7 bg-emerald-300 shadow-[0_0_14px_rgba(16,185,129,.65)]" : "w-1.5 bg-emerald-300/35"}`} />
            </div>
          </div>

          <div className="hidden items-stretch gap-5 lg:grid lg:grid-cols-[1fr_auto_1fr]">
            <MyLauraCard />
            <div className="flex items-center justify-center px-2">
              <ConnectionPill />
            </div>
            <ClaipperCard />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Workflow</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">A production <span className="text-emerald-400">flow</span> from source footage to performance.</h2>
        </div>
        <div className="grid gap-4 md:hidden">
          {workflow.map((item, index) => (
            <div key={item.title} className="relative rounded-xl border border-white/10 bg-slate-950/65 p-4">
              {index < workflow.length - 1 ? <div className="absolute bottom-[-1rem] left-7 h-4 w-px bg-emerald-300/30" /> : null}
              <div className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-sm font-semibold text-emerald-200">
                  {workflowStepNumbers[index]}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
          {workflow.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <LandingSection
        eyebrow="TIME SAVED"
        title={
          <>
            How much <span className="text-emerald-400">time</span> do you waste before the edit even starts?
          </>
        }
        subtitle="Adjust the numbers and see how much review time Claipper can save before you even start editing."
      >
        <CalculatorMockup />
      </LandingSection>

      <section className="border-t border-white/10 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-emerald-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,.24),transparent_28rem),linear-gradient(180deg,rgba(15,23,42,.75),rgba(2,6,23,.96))] px-5 py-12 text-center shadow-[0_36px_140px_-70px_rgba(16,185,129,.95)] sm:px-10 sm:py-16">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,.04)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.035)_1px,transparent_1px)] bg-[size:38px_38px] opacity-70" />
          <motion.div
            className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent"
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative mx-auto max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Start clipping</p>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Ready to clip faster?</h2>
            <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Start with a MyLaura brief or upload any long-form content. Claipper helps you find the moments, shape the angles and prepare clips for production.
            </p>
          </div>
          <div className="relative mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_0_28px_rgba(16,185,129,.28)] transition hover:bg-emerald-300"
            >
              Open App
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
            >
              See Workflow
              <Link2 className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
