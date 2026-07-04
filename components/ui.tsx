import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { BarChart3, CalendarClock, Clapperboard, Home, Library, Settings } from "lucide-react";
import type { ClipStatus } from "@/lib/types";

export const statusMeta: Record<ClipStatus, { label: string; className: string }> = {
  idea: { label: "Idea", className: "border-slate-500/30 bg-slate-500/10 text-slate-200" },
  selected: { label: "Selected", className: "border-blue-400/30 bg-blue-400/10 text-blue-100" },
  editing: { label: "Editing", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  ready: { label: "Ready", className: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" },
  scheduled: { label: "Scheduled", className: "border-amber-300/30 bg-amber-300/10 text-amber-100" },
  posted: { label: "Posted", className: "border-lime-300/30 bg-lime-300/10 text-lime-100" },
  reported: { label: "Reported", className: "border-violet-300/30 bg-violet-300/10 text-violet-100" },
  rejected: { label: "Rejected", className: "border-rose-300/30 bg-rose-300/10 text-rose-100" }
};

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ClipStatus }) {
  const meta = statusMeta[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("glass rounded-lg p-5", className)}>{children}</div>;
}

export function ButtonLink({
  href,
  children,
  variant = "primary"
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold transition",
        variant === "primary"
          ? "bg-emerald-400 text-slate-950 shadow-[0_0_28px_rgba(16,185,129,.28)] hover:bg-emerald-300"
          : "border border-white/15 bg-white/5 text-white hover:border-emerald-300/40 hover:bg-emerald-400/10"
      )}
    >
      {children}
    </Link>
  );
}

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/app", label: "Dashboard", icon: Home },
  { href: "/app/sources", label: "Zdroje", icon: Library },
  { href: "/app/clips", label: "Clips", icon: Clapperboard },
  { href: "/app/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/app/reports", label: "Reporty", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow?: string }) {
  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 -z-10 grid-mask opacity-80" />
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-black/30 p-4 backdrop-blur-xl lg:block">
        <Link href="/" className="mb-8 flex flex-col rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-3.5">
          <Image
            src="/images/claipper-logo.svg"
            alt="Claipper"
            width={900}
            height={220}
            priority
            className="h-12 w-auto max-w-[190px] object-contain"
          />
          <span className="mt-1 block text-xs text-emerald-200/70">Production workspace</span>
        </Link>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/7 hover:text-white">
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">{eyebrow}</p> : null}
              <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
            </div>
            <div className="flex flex-wrap gap-2 lg:hidden">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                  {item.label}
                </Link>
              ))}
            </div>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}

export function EmptyNotice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-slate-400">{children}</div>;
}
