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
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-emerald-400 text-slate-950">
          <LockKeyhole />
        </div>
        <h1 className="text-2xl font-semibold text-white">Claipper access</h1>
        <p className="mt-2 text-sm text-slate-400">Simple internal password through APP_PASSWORD.</p>
        <form action="/api/login" method="post" className="mt-6 space-y-4">
          <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
          <input
            name="password"
            type="password"
            placeholder="Password"
            className="h-11 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-emerald-400/60"
          />
          {params.error ? <p className="text-sm text-rose-200">Incorrect password.</p> : null}
          <button className="h-11 w-full rounded-md bg-emerald-400 font-semibold text-slate-950 hover:bg-emerald-300">
            Open dashboard
          </button>
        </form>
      </Card>
    </main>
  );
}
