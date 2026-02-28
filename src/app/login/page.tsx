import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gradient-mesh px-4">
      <div className="w-full max-w-sm glass-card rounded-2xl p-6 sm:p-8">
        <h1 className="text-xl font-bold tracking-tight">SignalDesk</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to access the dashboard.</p>
        <Suspense fallback={<div className="mt-6 text-sm text-muted-foreground animate-pulse">Loading…</div>}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
