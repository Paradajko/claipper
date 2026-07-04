import { LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
          <LockKeyhole />
        </div>
        <h1 className="text-2xl font-semibold text-white">Vstup do Claipperu</h1>
        <p className="mt-2 text-sm text-slate-400">Jednoduché interné heslo cez APP_PASSWORD.</p>
        <form action="/api/login" method="post" className="mt-6 space-y-4">
          <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
          <input
            name="password"
            type="password"
            placeholder="Heslo"
            className="h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-cyan-300/60"
          />
          {params.error ? <p className="text-sm text-rose-200">Nesprávne heslo.</p> : null}
          <button className="h-11 w-full rounded-md bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200">
            Otvoriť dashboard
          </button>
        </form>
      </Card>
    </main>
  );
}
