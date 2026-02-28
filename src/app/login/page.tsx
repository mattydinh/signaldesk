import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">SignalDesk</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to access the dashboard.</p>
        <Suspense fallback={<div className="mt-6 text-sm text-muted-foreground">Loading…</div>}>
          <LoginForm />
        </Suspense>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
