"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContactForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value;

    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("success");
      form.reset();
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-foreground">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="How can we help?"
        />
      </div>
      {status === "success" && (
        <p className="text-sm text-green-600">Thanks! We&apos;ll be in touch.</p>
      )}
      {status === "error" && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {status === "loading" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
