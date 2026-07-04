"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, BrainCircuit, CalendarClock, Captions, Clapperboard, FileText, Gauge, MousePointer2, ScanSearch, Sparkles, Workflow } from "lucide-react";
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
              MyLaura plans the campaign. Claipper turns that context into clip execution.
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">MyLaura</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Campaign intelligence</h3>
                </div>
                <BrainCircuit className="mt-1 text-emerald-300" />
              </div>
              <ul className="mt-6 grid gap-3 text-sm text-slate-300">
                {[
                  ["campaign briefs", FileText],
                  ["creator context", BrainCircuit],
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
              <div className="flex min-w-44 items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-[0_0_32px_rgba(16,185,129,.12)]">
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
                  {[
                    ["00:14:32", "Strong reaction", "91%"],
                    ["00:27:10", "Hook candidate", "84%"],
                    ["00:41:02", "Ready to edit", "88%"]
                  ].map(([time, label, score]) => (
                    <div key={time} className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs text-slate-500">{time}</span>
                        <span className="font-mono text-xs text-emerald-300">{score}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-white">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <ul className="grid gap-3 text-sm text-slate-300">
                {[
                  ["moment scanning", ScanSearch],
                  ["clip ideas", Clapperboard],
                  ["hooks & captions", Captions],
                  ["production workflow", Workflow]
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
