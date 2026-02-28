import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalDesk – Financial & Political Intelligence",
  description: "AI-powered intelligence analysis platform.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen antialiased bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
