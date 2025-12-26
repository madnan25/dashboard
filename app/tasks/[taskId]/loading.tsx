import { Surface } from "@/components/ds/Surface";

export default function LoadingTask() {
  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="px-1">
          <div className="h-6 w-28 rounded-lg bg-white/10 animate-pulse" />
          <div className="mt-2 h-4 w-80 rounded-lg bg-white/5 animate-pulse" />
        </div>

        <div className="grid gap-4 md:grid-cols-12">
          <Surface className="md:col-span-7">
            <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
            <div className="mt-3 h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
            <div className="mt-3 h-24 w-full rounded-2xl bg-white/5 animate-pulse" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-10 w-full rounded-2xl bg-white/5 animate-pulse" />
            </div>
          </Surface>
          <Surface className="md:col-span-5">
            <div className="h-5 w-24 rounded bg-white/10 animate-pulse" />
            <div className="mt-3 h-4 w-44 rounded bg-white/5 animate-pulse" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
              ))}
            </div>
          </Surface>
        </div>
      </div>
    </main>
  );
}

