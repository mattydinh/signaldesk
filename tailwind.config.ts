import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      maxWidth: {
        "feed": "1200px",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },
      fontSize: {
        "page-title": ["36px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.02em" }],
        "section-header": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "card-title": ["18px", { lineHeight: "1.4", fontWeight: "500" }],
        "body": ["14px", { lineHeight: "1.6", fontWeight: "400" }],
        "meta": ["12px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--foreground))" },
      },
      borderRadius: {
        "card": "20px",
        "pill": "999px",
        "badge": "8px",
        "btn": "8px",
      },
      transitionDuration: {
        "150": "150ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
