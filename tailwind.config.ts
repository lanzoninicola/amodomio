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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
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
        urw: ["var(--font-urw)", ...fontFamily.sans],
        neue: ["var(--font-neue)", ...fontFamily.sans],
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
        fadeInTag: {
          "0%": { opacity: 0, transform: "translateY(-5px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        // Novas animações customizadas
        fadeInUp: {
          "0%": {
            opacity: "0",
            transform: "translateY(30px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        shimmer: {
          "0%": {
            transform: "translateX(-100%) skewX(-12deg)",
          },
          "100%": {
            transform: "translateX(100%) skewX(-12deg)",
          },
        },
        float: {
          "0%, 100%": {
            transform: "translateY(0px)",
          },
          "50%": {
            transform: "translateY(-10px)",
          },
        },
        glow: {
          "0%, 100%": {
            opacity: "0.5",
            transform: "scale(1)",
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.05)",
          },
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
        zoomOnce: "zoomOnce 2.5s ease-out forwards",
        fadeInTag: "fadeIn 0.3s ease-out forwards",
        // Novas animações customizadas
        fadeInUp: "fadeInUp 0.6s ease-out",
        shimmer: "shimmer 2s infinite",
        floatSlow: "float 3s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
      },
      backgroundImage: {
        hero: "url('/images/hero-image.jpg')",
        banner: "url('/images/cardapio-web-app/banner.jpg')",
        "banner-md": "url('/images/cardapio-web-app/banner-md.jpg')",
        "pizza-placeholder-sm":
          "url('/images/cardapio-web-app/pizza-placeholder-sm.jpg')",
      },
      // Transitions customizadas
      transitionProperty: {
        height: "height",
        spacing: "margin, padding",
        "colors-transform": "color, background-color, border-color, transform",
      },

      // Durations adicionais
      transitionDuration: {
        "350": "350ms",
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
      },

      // Timing functions customizadas
      transitionTimingFunction: {
        "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        slide: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      },

      // Backdrop blur customizado
      backdropBlur: {
        xs: "2px",
        "4xl": "72px",
      },

      // Scales customizadas para hover
      scale: {
        "102": "1.02",
        "103": "1.03",
        "98": "0.98",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // Plugin para desabilitar hover em touch devices
    function ({ addUtilities }) {
      const newUtilities = {
        "@media (hover: none)": {
          ".hover\\:scale-105:hover": {
            transform: "none",
          },
          ".hover\\:scale-102:hover": {
            transform: "none",
          },
          ".hover\\:scale-103:hover": {
            transform: "none",
          },
          ".hover\\:scale-110:hover": {
            transform: "none",
          },
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
