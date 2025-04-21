const { fontFamily } = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./app/components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        "brand-blue": {
          DEFAULT: "var(--brand-blue)",
        },
        "brand-orange": {
          DEFAULT: "var(--brand-orange)",
        },
        "brand-violet": {
          DEFAULT: "var(--brand-violet)",
        },
        "brand-red": {
          DEFAULT: "var(--brand-red)",
        },
        "brand-yellow": {
          DEFAULT: "var(--brand-yellow)",
        },
        "brand-green": {
          DEFAULT: "var(--brand-green)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        body: ["var(--font-sans)", ...fontFamily.sans],
        "body-website": ["var(--font-sans-website)", ...fontFamily.sans],
        accent: ["var(--font-accent)", ...fontFamily.sans],
        title: ["var(--font-title)", ...fontFamily.sans],
        rubik: ["var(--font-rubik)", ...fontFamily.sans],
        gayathri: ["var(--font-gayathri)", ...fontFamily.sans],
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "rotate-360": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "slide-in-up": {
          "0%": {
            visibility: "visible",
            transform: "translate3d(0, 100%, 0)",
          },
          "100%": {
            transform: "translate3d(0, 0, 0)",
          },
        },
        move: {
          "0%": {
            opacity: "0.1",
            transform: "translateX(200px)",
          },
          "10%": {
            opacity: 0.7,
          },
          "90%": {
            opacity: 0,
          },
          "100%": {
            opacity: 0,
            transform: "translateX(-1000px)",
          },
        },
        scrollingText: {
          "0%": {
            transform: "translateX(100%)",
          },
          "100%": {
            transform: "translateX(-100%)",
          },
        },
        slowZoom: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        zoomOnce: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.05)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "rotate-360": "rotate-360 1s linear infinite",
        "rotate-360-slow": "rotate-360 15s linear infinite",
        "slide-in-up": "slide-in-up 0.4s ease-in-out",
        move: "move 8s ease-in-out infinite",
        "move-slow": "move 9.2s ease-in-out infinite",
        "move-slower": "move 11.2s ease-in-out infinite",
        "move-slowest": "move 13.5s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        fadeIn: "fadeIn 1s ease-in-out",
        pulseFast: "pulse .5s ease-in-out infinite",
        pulse: "pulse 1s ease-in-out infinite",
        pulseSlow: "pulse 2s ease-in-out infinite",
        scrollingText: "scrollingText 18s linear infinite",
        slowZoom: "slowZoom 20s infinite linear",
        animation: {
          zoomOnce: "zoomOnce 2.5s ease-out forwards",
        },
      },
      backgroundImage: {
        hero: "url('/images/hero-image.jpg')",
        banner: "url('/images/cardapio-web-app/banner.jpg')",
        "banner-md": "url('/images/cardapio-web-app/banner-md.jpg')",
        "pizza-placeholder-sm":
          "url('/images/cardapio-web-app/pizza-placeholder-sm.jpg')",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
