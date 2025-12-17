import { Suspense } from "react";
import LoginForm from "./ui";

export default function LoginPage() {
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

