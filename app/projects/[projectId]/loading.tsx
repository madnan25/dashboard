import { Surface } from "@/components/ds/Surface";

export default function LoadingProjectHub() {
  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-24 rounded-2xl bg-white/5 animate-pulse" />
            <div>
              <div className="h-6 w-56 rounded-lg bg-white/10 animate-pulse" />
              <div className="mt-2 h-4 w-64 rounded-lg bg-white/5 animate-pulse" />
            </div>
          </div>
          <div className="h-10 w-28 rounded-2xl bg-white/5 animate-pulse" />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Surface key={i} className="h-[110px]">
              <div className="h-full w-full animate-pulse">
                <div className="h-4 w-28 rounded bg-white/5" />
                <div className="mt-3 h-6 w-32 rounded bg-white/10" />
              </div>
            </Surface>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-12">
          <Surface className="md:col-span-7 h-[420px]">
            <div className="h-full w-full animate-pulse">
              <div className="h-5 w-44 rounded bg-white/10" />
              <div className="mt-3 h-4 w-72 rounded bg-white/5" />
              <div className="mt-8 grid gap-3 md:grid-cols-2">
                <div className="h-[140px] rounded-2xl bg-white/[0.03]" />
                <div className="h-[140px] rounded-2xl bg-white/[0.03]" />
              </div>
            </div>
          </Surface>
          <Surface className="md:col-span-5 h-[420px]">
            <div className="h-full w-full animate-pulse">
              <div className="h-5 w-44 rounded bg-white/10" />
              <div className="mt-3 h-4 w-64 rounded bg-white/5" />
              <div className="mt-8 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-xl bg-white/[0.03]" />
                ))}
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </main>
  );
}
