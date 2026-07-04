import Link from "next/link";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { BarChart3, CalendarClock, Clapperboard, Home, Library, Settings, Workflow } from "lucide-react";
import type { ClipStatus } from "@/lib/types";

export const statusMeta: Record<ClipStatus, { label: string; className: string }> = {
  idea: { label: "Idea", className: "border-slate-500/30 bg-slate-500/10 text-slate-200" },
  selected: { label: "Selected", className: "border-blue-400/30 bg-blue-400/10 text-blue-100" },
  editing: { label: "Editing", className: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" },
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
          ? "bg-cyan-300 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,.28)] hover:bg-cyan-200"
          : "border border-white/15 bg-white/5 text-white hover:border-cyan-200/40 hover:bg-cyan-300/10"
      )}
    >
      {children}
    </Link>
  );
}

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/sources", label: "Zdroje", icon: Library },
  { href: "/clips", label: "Clips", icon: Clapperboard },
  { href: "/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/reports", label: "Reporty", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow?: string }) {
  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 -z-10 grid-mask opacity-80" />
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-black/30 p-4 backdrop-blur-xl lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
            <Workflow size={22} />
          </span>
          <span>
            <span className="block text-base font-bold">Claipper</span>
            <span className="block text-xs text-cyan-100/70">Production workspace</span>
          </span>
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
              {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{eyebrow}</p> : null}
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
