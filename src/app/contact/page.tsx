import Link from "next/link";
import { ContactForm } from "./ContactForm";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            SignalDesk
          </Link>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-2xl font-semibold">Contact / Request a demo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Get in touch for partnerships, investment discussions, or a demo of the platform.
        </p>
        <ContactForm />
      </main>
    </div>
  );
}
