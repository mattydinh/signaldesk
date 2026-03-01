import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gradient-mesh px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="glass-card rounded-card p-8">
          <h1 className="text-display-sm text-foreground tracking-tight">SignalDesk</h1>
          <p className="mt-2 text-body-sm text-muted-foreground">Sign in to access the dashboard.</p>
          <Suspense fallback={<div className="mt-8 text-body-sm text-muted-foreground animate-pulse">Loading…</div>}>
            <LoginForm />
          </Suspense>
          <p className="mt-8 text-center text-caption text-muted-foreground">
            <Link href="/" className="hover:text-foreground focus-visible:underline transition-colors">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
