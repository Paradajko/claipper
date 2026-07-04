"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Captions, Clapperboard, MousePointer2, Sparkles } from "lucide-react";
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
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Role split</p>
            <h2 className="text-4xl font-semibold tracking-tight text-white">MyLaura runs campaigns. Claipper produces clips.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <Clapperboard className="mb-4 text-emerald-300" />
              <h3 className="mb-3 text-xl font-semibold text-white">Claipper</h3>
              <p className="text-sm leading-6 text-slate-300">Moments, hooks, subtitles, captions, scheduling, and reporting. A production workspace for the lead clipper.</p>
            </Card>
            <Card>
              <Captions className="mb-4 text-slate-300" />
              <h3 className="mb-3 text-xl font-semibold text-white">MyLaura</h3>
              <p className="text-sm leading-6 text-slate-300">Campaigns, clients, tracking, and payouts. Claipper keeps the campaign name and URL only as production references.</p>
            </Card>
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
