import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "./ui";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirectTo?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const redirectTo = typeof sp.redirectTo === "string" && sp.redirectTo.startsWith("/") ? sp.redirectTo : "/";

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      redirect(redirectTo);
    }
  } catch {
    // If env is missing or auth check fails, show login UI.
  }

  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6">
          <div className="mx-auto w-full max-w-md" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

