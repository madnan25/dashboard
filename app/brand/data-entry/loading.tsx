import { Surface } from "@/components/ds/Surface";

export default function LoadingPlanning() {
  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-24 rounded-2xl bg-white/5 animate-pulse" />
            <div>
              <div className="h-6 w-56 rounded-lg bg-white/10 animate-pulse" />
              <div className="mt-2 h-4 w-72 rounded-lg bg-white/5 animate-pulse" />
            </div>
          </div>
          <div className="h-10 w-28 rounded-2xl bg-white/5 animate-pulse" />
        </div>

        <Surface className="h-[84px]">
          <div className="h-full w-full animate-pulse" />
        </Surface>

        <div className="grid gap-4 md:grid-cols-12">
          <Surface className="md:col-span-5 h-[420px]">
            <div className="h-full w-full animate-pulse" />
          </Surface>
          <Surface className="md:col-span-7 h-[420px]">
            <div className="h-full w-full animate-pulse" />
          </Surface>
        </div>

        <Surface className="h-[360px]">
          <div className="h-full w-full animate-pulse" />
        </Surface>
      </div>
    </main>
  );
}
