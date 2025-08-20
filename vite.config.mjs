import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { installGlobals } from "@remix-run/node";
import mkcert from 'vite-plugin-mkcert'
import { RemixVitePWA } from "@vite-pwa/remix";

installGlobals();
// Gera um hash/versão por build com base em timestamp
const buildVersion = `v${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;

const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion) // para usar no frontend
  },
  server: {
    https: true,
    host: 'localhost', // importante manter "localhost"
    port: 3000
  },
  plugins: [
    mkcert(),
    remix({
      presets: [RemixPWAPreset()],
      ignoredRouteFiles: ["**/*.css"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true
      },
    }),

    RemixVitePWAPlugin({
      registerType: "autoUpdate",
      injectRegister: "auto", // assegura que o registro será feito
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
      workbox: {
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\.(png|jpe?g|gif|svg|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /^\/(sabores|promocoes|ofertas)$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "dynamic-pages",
              expiration: { maxEntries: 20, maxAgeSeconds: 3600 }
            }
          }
        ]
      },
      devOptions: {
        navigateFallback: "/_offline"
      }
    }),

    tsconfigPaths()
  ]
});
