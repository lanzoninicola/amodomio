import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { installGlobals } from "@remix-run/node"
import { RemixVitePWA } from "@vite-pwa/remix";

installGlobals();

const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA(); // sem opções aqui

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    // ① Remix ‑ agora com o preset
    remix({
      presets: [RemixPWAPreset()],
      ignoredRouteFiles: ["**/*.css"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true
      },
    }),

    // ② Plugin PWA com suas opções
    RemixVitePWAPlugin({
      registerType: "autoUpdate",
      manifest: {
        name: "A Modo Mio",
        short_name: "A Modo Mio",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#262626",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },

      // — ponto 6 —
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\.(png|jpe?g|gif|svg|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },

      // — ponto 7 —
      devOptions: { navigateFallback: "/_offline" }
    }),

    // ③ Qualquer outro plugin
    tsconfigPaths()
  ]
});
