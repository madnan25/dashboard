import { Surface } from "@/components/ds/Surface";

export default function LoadingProjects() {
  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="px-1">
          <div className="h-6 w-40 rounded-lg bg-white/10 animate-pulse" />
          <div className="mt-2 h-4 w-64 rounded-lg bg-white/5 animate-pulse" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Surface key={i} className="h-[170px]">
              <div className="h-full w-full animate-pulse">
                <div className="h-5 w-44 rounded bg-white/10" />
                <div className="mt-3 h-4 w-64 rounded bg-white/5" />
                <div className="mt-10 h-4 w-24 rounded bg-white/5" />
              </div>
            </Surface>
          ))}
        </div>
      </div>
    </main>
  );
}
