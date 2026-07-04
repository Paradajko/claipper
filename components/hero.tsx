"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Scissors, Sparkles, TrendingUp } from "lucide-react";
import { clsx } from "clsx";

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

const stages = [
  { value: "01:00:00", label: "RAW FOOTAGE", accessory: "bar" },
  { value: "38 moments", label: "DETECTED", accessory: "dot" },
  { value: "14 clip ideas", label: "SUGGESTED", accessory: "sparkle" },
  { value: "Early access", label: "AVAILABLE SOON", accessory: "check" }
] as const;

const floatingBadges = [
  { label: "Hook generated", icon: Sparkles, className: "right-2 top-4 sm:-right-8 sm:top-12", delay: 2 },
  { label: "Caption ready", icon: CheckCircle2, className: "left-2 top-28 sm:-left-12 sm:top-32", delay: 2.2 },
  { label: "Best moment: 00:14:32", icon: Clock, className: "right-0 bottom-20 sm:-right-16 sm:bottom-24", delay: 2.4 },
  { label: "Score: 91%", icon: TrendingUp, className: "left-1 bottom-36 sm:-left-8 sm:bottom-40", delay: 2.6 },
  { label: "Available in early access", icon: Scissors, className: "right-1 top-1/2 sm:-right-20", delay: 2.8 }
] as const;

export default function Hero({ copy = defaultCopy, onPrimaryCta }: { copy?: HeroCopy; onPrimaryCta?: () => void }) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants: Variants | undefined = shouldReduceMotion
    ? undefined
    : {
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.3 }
        }
      };

  const stageVariants: Variants | undefined = shouldReduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 20, boxShadow: "0 0 0 rgba(16,185,129,0)" },
        visible: (index: number) => ({
          opacity: 1,
          y: 0,
          boxShadow:
            index === stages.length - 1
              ? ["0 0 0 rgba(16,185,129,0)", "0 0 26px rgba(16,185,129,.36)", "0 0 16px rgba(16,185,129,.18)"]
              : ["0 0 0 rgba(16,185,129,0)", "0 0 20px rgba(16,185,129,.22)", "0 0 0 rgba(16,185,129,0)"],
          transition: {
            opacity: { duration: 0.4, ease: "easeOut" },
            y: { duration: 0.4, ease: "easeOut" },
            boxShadow: { duration: 0.6, ease: "easeOut" }
          }
        })
      };

  return (
    <section className="mx-auto grid min-h-[calc(100vh-82px)] max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
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

      <div className="relative isolate mx-auto w-full max-w-xl lg:mr-0">
        <div className="absolute -inset-5 rounded-[2rem] bg-emerald-400/10 blur-3xl" />
        <motion.div
          className="relative min-h-[420px] rounded-2xl border border-emerald-400/20 bg-slate-900/60 p-4 shadow-[0_0_60px_rgba(16,185,129,.15)] backdrop-blur-xl sm:p-6"
          variants={containerVariants}
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
        >
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <motion.div
                key={stage.label}
                variants={stageVariants}
                custom={index}
                className={clsx(
                  "rounded-lg border p-4",
                  index === stages.length - 1 ? "border-emerald-400/40 bg-emerald-400/5" : "border-emerald-400/10 bg-white/[0.03]"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-3xl font-bold text-white">{stage.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{stage.label}</p>
                  </div>
                  <StageAccessory type={stage.accessory} />
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-6 flex items-center justify-between gap-2 text-xs font-mono text-slate-500"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 1.5, duration: 0.4, ease: "easeOut" }}
          >
            <span>00:00</span>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden">
              <span className="h-px min-w-6 flex-1 bg-slate-700" />
              {[0, 1, 2, 3, 4].map((dot) => (
                <span key={dot} className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,.55)]" />
              ))}
              <span className="h-px min-w-6 flex-1 bg-slate-700" />
            </div>
            <span>60:00</span>
          </motion.div>
        </motion.div>

        {floatingBadges.map((badge) => (
          <FloatingBadge key={badge.label} badge={badge} shouldReduceMotion={Boolean(shouldReduceMotion)} />
        ))}
      </div>
    </section>
  );
}

function StageAccessory({ type }: { type: (typeof stages)[number]["accessory"] }) {
  if (type === "bar") {
    return (
      <div className="mt-2 h-2 w-24 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full w-full rounded-full bg-emerald-400" />
      </div>
    );
  }

  if (type === "dot") {
    return <span className="mt-3 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(16,185,129,.65)]" />;
  }

  if (type === "sparkle") {
    return <Sparkles className="mt-1 text-emerald-300" size={22} />;
  }

  return <CheckCircle2 className="mt-1 text-emerald-300" size={24} />;
}

function FloatingBadge({
  badge,
  shouldReduceMotion
}: {
  badge: (typeof floatingBadges)[number];
  shouldReduceMotion: boolean;
}) {
  const Icon = badge.icon;

  return (
    <motion.div
      className={clsx(
        "absolute z-10 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-slate-900/80 px-3 py-1.5 text-xs text-emerald-200 backdrop-blur",
        badge.className
      )}
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
      animate={
        shouldReduceMotion
          ? { opacity: 1, scale: 1 }
          : {
              opacity: 1,
              scale: 1,
              y: [0, -6, 0]
            }
      }
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              opacity: { delay: badge.delay, duration: 0.35 },
              scale: { delay: badge.delay, duration: 0.35 },
              y: { delay: badge.delay, duration: 4, repeat: Infinity, ease: "easeInOut" }
            }
      }
    >
      <Icon className="text-slate-400" size={14} />
      <span>{badge.label}</span>
    </motion.div>
  );
}
