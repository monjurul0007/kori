import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        scrim: "hsl(var(--scrim))",
        surface: "hsl(var(--surface))",
        track: "hsl(var(--track))",
        brand: {
          DEFAULT: "hsl(var(--primary))",
          strong: "hsl(var(--brand-strong))",
          soft: "hsl(var(--brand-soft))",
          text: "hsl(var(--brand-text))",
        },
        accent: "hsl(var(--accent))",
        income: "hsl(var(--income))",
        over: "hsl(var(--over))",
        warn: "hsl(var(--warn))",
        hero: {
          DEFAULT: "hsl(var(--hero))",
          foreground: "hsl(var(--hero-foreground))",
          muted: "hsl(var(--hero-muted))",
        },
        cat: {
          food: "hsl(var(--cat-food))",
          groc: "hsl(var(--cat-groc))",
          trans: "hsl(var(--cat-trans))",
          rent: "hsl(var(--cat-rent))",
          util: "hsl(var(--cat-util))",
          mob: "hsl(var(--cat-mob))",
          health: "hsl(var(--cat-health))",
          shop: "hsl(var(--cat-shop))",
          other: "hsl(var(--cat-other))",
          salary: "hsl(var(--cat-salary))",
        },
      },
      fontFamily: {
        display: ['"Anek Bangla Variable"', "system-ui", "sans-serif"],
        sans: ['"Hind Siliguri"', "system-ui", "sans-serif"],
      },
      borderRadius: { lg: "0.5rem", md: "calc(0.5rem - 2px)", sm: "calc(0.5rem - 4px)" },
    },
  },
  plugins: [animate],
} satisfies Config;
