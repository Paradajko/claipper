"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, CalendarClock, Check, FileText, Gauge, MousePointer2, Sparkles, UserRound } from "lucide-react";
import Hero from "@/components/hero";
import { Card } from "@/components/ui";

const workflow = [
  { icon: MousePointer2, title: "Pick the moment", text: "Save the timestamp, source, score, and the reason a passage has clip potential." },
  { icon: Sparkles, title: "Shape the angle", text: "Use AI support for hooks, captions, hashtags, and calls to action in one production flow." },
  { icon: CalendarClock, title: "Plan the output", text: "Track platform, account, post URL, publishing status, and early performance signals." }
];

const heroCopy = {
  title: "You don't need to watch it all.",
  subtitle: "Find the strongest moments in long videos and turn them into clip ideas without scrubbing through hours of footage.",
  primaryCta: "Find Moments",
  secondaryCta: "See Workflow"
} as const;

function ClaipperClipVisual() {
  return (
    <div className="relative mb-5 flex h-80 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,.16),transparent_24rem),linear-gradient(180deg,rgba(15,23,42,.4),rgba(2,6,23,.94))] px-6 py-8">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,.06)_1px,transparent_1px),linear-gradient(rgba(148,163,184,.05)_1px,transparent_1px)] bg-[size:38px_38px] opacity-70" />
      <div className="relative z-10 flex w-full flex-col justify-center gap-10">
        <div>
          <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Long video becomes short clips</p>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
            <span>00:00</span>
            <div className="relative h-3 flex-1">
              <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-slate-800" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
              <motion.span
                className="absolute top-1/2 h-9 w-16 -translate-y-1/2 rounded-full bg-cyan-300/20 blur-md"
                animate={{ left: ["0%", "88%", "0%"] }}
                transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
              />
              {[24, 56, 76].map((left, index) => (
                <motion.span
                  key={left}
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70 bg-emerald-300 shadow-[0_0_22px_rgba(45,212,191,.85)]"
                  style={{ left: `${left}%` }}
                  animate={{ scale: [0.9, 1.22, 0.9], opacity: [0.65, 1, 0.65] }}
                  transition={{ delay: index * 0.35, duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </div>
            <span>60:00</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["Clip 01", "Clip 02", "Clip 03"].map((label, index) => (
            <motion.div
              key={label}
              className="relative mx-auto aspect-[9/14] w-full max-w-[5.8rem] overflow-hidden rounded-xl border border-cyan-200/15 bg-slate-950 shadow-[0_18px_45px_-24px_rgba(34,211,238,.7)]"
              initial={false}
              animate={{ opacity: [0.45, 1, 1, 0.45], y: [12, 0, 0, 12] }}
              transition={{ delay: 0.7 + index * 0.28, duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(20,184,166,.1),transparent_42%),radial-gradient(circle_at_35%_30%,rgba(34,211,238,.35),transparent_28%),linear-gradient(180deg,rgba(15,23,42,.4),rgba(2,6,23,.92))]" />
              <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200">Ready</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-300 text-slate-950">
                  <Check className="h-3 w-3" />
                </span>
              </div>
              <span className="absolute bottom-3 left-3 text-[10px] font-semibold text-white/80">{label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingClient() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-mask opacity-80" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/images/claipper-logo.svg"
            alt="Claipper"
            width={900}
            height={220}
            priority
            className="h-14 w-auto max-w-[230px] object-contain sm:h-16"
          />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 sm:flex">
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
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Connected workflow</p>
            <h2 className="text-4xl font-semibold tracking-tight text-white">MyLaura x Claipper</h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Laura plans the campaign. Claipper gets the clips ready.
            </p>
          </div>

          <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr]">
            <div className="overflow-hidden rounded-2xl border border-emerald-400/15 bg-slate-950/70 p-5 shadow-[0_24px_80px_-35px_rgba(0,0,0,.95)]">
              <div className="relative mb-5 flex h-80 items-end justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-emerald-400/10 via-slate-950/20 to-slate-950">
                <div className="absolute inset-x-8 bottom-0 h-36 rounded-full bg-emerald-400/15 blur-3xl" />
                <Image
                  src="/images/laura-mylaura.png"
                  alt="Laura, MyLaura campaign intelligence visual"
                  width={1735}
                  height={2643}
                  priority={false}
                  sizes="(min-width: 1024px) 430px, 90vw"
                  className="relative z-10 h-full w-auto object-contain object-bottom"
                />
              </div>
              <div className="flex h-20 items-center justify-start">
                <Image
                  src="/images/my-laura-logo-dark-bg.png"
                  alt="MyLaura"
                  width={577}
                  height={176}
                  sizes="260px"
                  className="h-auto w-[min(260px,100%)] object-contain object-left"
                />
              </div>
              <h3 className="mt-2 text-2xl font-semibold text-white">Campaign intelligence</h3>
              <ul className="mt-6 grid gap-3 text-sm text-slate-300">
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

            <div className="hidden items-center justify-center px-2 lg:flex">
              <div className="relative flex min-w-44 items-center gap-3 overflow-hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-[0_0_32px_rgba(16,185,129,.12)]">
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
                <span>Campaign context</span>
                <ArrowRight className="h-4 w-4" />
                <span>Clip execution</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-emerald-400/15 bg-slate-950/70 p-5 shadow-[0_24px_80px_-35px_rgba(0,0,0,.95)]">
              <ClaipperClipVisual />
              <div className="flex h-20 items-center justify-start">
                <Image
                  src="/images/claipper-logo.svg"
                  alt="Claipper"
                  width={900}
                  height={220}
                  sizes="330px"
                  className="h-auto w-[min(330px,100%)] object-contain object-left"
                />
              </div>
              <h3 className="mt-2 text-2xl font-semibold text-white">Clip production workspace</h3>
              <ul className="mt-6 grid gap-3 text-sm text-slate-300">
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
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Workflow</p>
          <h2 className="text-4xl font-semibold tracking-tight text-white">A production flow from source footage to performance.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {workflow.map((item) => (
            <Card key={item.title} className="neon-line">
              <item.icon className="mb-4 text-emerald-300" />
              <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
              <p className="text-sm leading-6 text-slate-300">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
