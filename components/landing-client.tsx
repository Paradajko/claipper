"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, CalendarClock, Captions, Clapperboard, FileText, Gauge, MousePointer2, Sparkles, UserRound, Workflow } from "lucide-react";
import Hero from "@/components/hero";
import RequestAccessModal from "@/components/RequestAccessModal";
import { Card } from "@/components/ui";

const workflow = [
  { icon: MousePointer2, title: "Pick the moment", text: "Save the timestamp, source, score, and the reason a passage has clip potential." },
  { icon: Sparkles, title: "Shape the angle", text: "Use AI support for hooks, captions, hashtags, and calls to action in one production flow." },
  { icon: CalendarClock, title: "Plan the output", text: "Track platform, account, post URL, publishing status, and early performance signals." }
];

const heroCopy = {
  title: "You don't need to watch it all.",
  subtitle: "Find the strongest moments in long videos and turn them into clip ideas without scrubbing through hours of footage.",
  primaryCta: "Get Clips",
  secondaryCta: "See how it works"
} as const;

export default function LandingClient() {
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-mask opacity-80" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-bold text-white">
          cl<span className="text-emerald-400">AI</span>pper
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 sm:flex">
          <a href="#mylaura" className="transition hover:text-white">MyLaura x Claipper</a>
          <button
            type="button"
            onClick={() => setRequestAccessOpen(true)}
            className="rounded-md border border-emerald-400/30 px-4 py-2 text-emerald-200 transition hover:bg-emerald-400/10"
          >
            Get Clips
          </button>
        </nav>
      </header>

      <Hero copy={heroCopy} onPrimaryCta={() => setRequestAccessOpen(true)} />
      <RequestAccessModal open={requestAccessOpen} onClose={() => setRequestAccessOpen(false)} />

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
              <div>
                <Image
                  src="/images/my-laura-logo.png"
                  alt="MyLaura"
                  width={1304}
                  height={252}
                  sizes="240px"
                  className="h-10 w-auto rounded-sm bg-white px-2 py-1"
                />
                <h3 className="mt-2 text-2xl font-semibold text-white">Campaign intelligence</h3>
              </div>
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

            <div className="rounded-2xl border border-emerald-400/15 bg-slate-950/70 p-5 shadow-[0_24px_80px_-35px_rgba(0,0,0,.95)]">
              <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Claipper</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Clip production workspace</h3>
                  </div>
                  <Workflow className="text-emerald-300" />
                </div>
                <div className="grid gap-3">
                  <motion.div
                    className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3 shadow-[0_0_26px_rgba(16,185,129,.08)]"
                    animate={{ borderColor: ["rgba(16,185,129,.22)", "rgba(16,185,129,.48)", "rgba(16,185,129,.22)"] }}
                    transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Brief from Laura</p>
                    <div className="mt-2 grid gap-1.5 text-xs text-slate-300">
                      <p><span className="text-slate-500">Goal:</span> Awareness</p>
                      <p><span className="text-slate-500">Audience:</span> SK/CZ creators</p>
                      <p><span className="text-slate-500">Tone:</span> Fast, funny, direct</p>
                    </div>
                  </motion.div>

                  <div className="relative flex items-center justify-between overflow-hidden rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] font-semibold text-slate-300">
                    <motion.span
                      className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent"
                      animate={{ x: [-72, 360] }}
                      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <span>Campaign context</span>
                    <ArrowRight className="h-4 w-4 text-emerald-300" />
                    <span>Clip angles</span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {["Funny reaction hook", "Creator POV moment", "Problem -> solution"].map((angle, index) => (
                      <motion.div
                        key={angle}
                        className="rounded-lg border border-white/10 bg-slate-950/60 p-2.5 text-xs font-medium leading-5 text-white"
                        initial={false}
                        animate={{ opacity: [0.55, 1, 1, 0.75], y: [6, 0, 0, 0] }}
                        transition={{ delay: 1.15 + index * 0.35, duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {angle}
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] p-3"
                    animate={{ boxShadow: ["0 0 0 rgba(16,185,129,0)", "0 0 28px rgba(16,185,129,.18)", "0 0 0 rgba(16,185,129,0)"] }}
                    transition={{ delay: 2.4, duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Production queue ready</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        ["8", "clips to edit"],
                        ["4", "captions ready"],
                        ["3", "posts scheduled"]
                      ].map(([value, label]) => (
                        <div key={label} className="rounded-lg border border-white/10 bg-slate-950/55 px-2 py-2">
                          <p className="font-mono text-lg font-semibold text-white">{value}</p>
                          <p className="mt-1 text-[10px] leading-3 text-slate-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
              <ul className="grid gap-3 text-sm text-slate-300">
                {[
                  ["clip angles", Clapperboard],
                  ["hooks & captions", Captions],
                  ["production tasks", Workflow],
                  ["scheduled outputs", CalendarClock]
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
