import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, Captions, Clapperboard, MousePointer2, Sparkles, Workflow } from "lucide-react";
import { Badge, ButtonLink, Card } from "@/components/ui";

const workflow = [
  { icon: MousePointer2, title: "Vyber moment", text: "Ulož čas, zdroj, score a poznámku k tomu, prečo má pasáž potenciál." },
  { icon: Sparkles, title: "Dolaď hook", text: "AI helper pomôže s hookom, captionom, hashtagmi a CTA v slovenčine." },
  { icon: CalendarClock, title: "Naplánuj výstup", text: "Vidíš platformu, účet, post URL, stav publikovania a prvé performance čísla." }
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-mask opacity-80" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-400 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,.45)]">
            <Workflow size={22} />
          </span>
          <span className="text-lg font-bold text-white">Claipper</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 sm:flex">
          <a href="#ako-to-funguje" className="hover:text-white">Ako to funguje</a>
          <a href="#mylaura" className="hover:text-white">MyLaura vs Claipper</a>
          <Link href="/dashboard" className="rounded-md border border-emerald-400/30 px-4 py-2 text-emerald-200 hover:bg-emerald-400/10">Dashboard</Link>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-82px)] max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div className="max-w-2xl">
          <Badge className="mb-5 border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Clipping production workspace</Badge>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Od dlhého videa po hotový short bez chaosu.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Claipper pomáha hlavnému clipperovi riadiť celý proces tvorby shortov — od výberu momentov cez hooky a captiony až po harmonogram a report výkonu.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/dashboard">
              Otvoriť dashboard <ArrowRight size={17} />
            </ButtonLink>
            <ButtonLink href="#ako-to-funguje" variant="secondary">
              Ako to funguje
            </ButtonLink>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm text-slate-300">
            {["momenty", "hooky", "report výkonu"].map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-3">
                <BadgeCheck className="mb-2 text-emerald-300" size={17} />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 rounded-[32px] bg-emerald-400/10 blur-3xl" />
          <Image
            src="/images/claipper-dashboard-mockup.png"
            alt="Claipper dashboard mockup"
            width={1536}
            height={1024}
            priority
            className="relative rounded-lg border border-emerald-300/20 shadow-glow"
          />
        </div>
      </section>

      <section id="mylaura" className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Rozdelenie rolí</p>
            <h2 className="text-4xl font-semibold tracking-tight text-white">MyLaura spúšťa kampane. Claipper vyrába obsah.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <Clapperboard className="mb-4 text-emerald-300" />
              <h3 className="mb-3 text-xl font-semibold text-white">Claipper</h3>
              <p className="text-sm leading-6 text-slate-300">Momenty, hooky, titulky, captiony, schedule a report. Interný pracovný priestor pre hlavného clippera.</p>
            </Card>
            <Card>
              <Captions className="mb-4 text-slate-300" />
              <h3 className="mb-3 text-xl font-semibold text-white">MyLaura</h3>
              <p className="text-sm leading-6 text-slate-300">Kampane, klienti, tracking a payouts. V Claipperi zostáva len názov a URL ako referencia.</p>
            </Card>
          </div>
        </div>
      </section>

      <section id="ako-to-funguje" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Workflow</p>
          <h2 className="text-4xl font-semibold tracking-tight text-white">Produkčný tok od zdroja po výkon.</h2>
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
