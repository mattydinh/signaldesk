import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gradient-mesh px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm">
        <div className="glass-card rounded-card border border-[#27272A] p-8">
          <h1 className="text-section-header text-foreground">SignalDesk</h1>
          <p className="mt-2 text-body text-[#A1A1AA]">Sign in to access the dashboard.</p>
          <Suspense fallback={<div className="mt-8 text-body text-[#A1A1AA] animate-pulse">Loading…</div>}>
            <LoginForm />
          </Suspense>
          <p className="mt-8 text-center text-meta text-[#71717A]">
            <Link href="/" className="hover:text-foreground focus-visible:underline transition-colors">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
