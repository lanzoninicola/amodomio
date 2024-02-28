import type { LinksFunction, V2_MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { Toaster } from "./components/ui/toaster";
import stylesheet from "~/tailwind.css";
import { cssBundleHref } from "@remix-run/css-bundle";
import GoogleTagManagerScriptTag from "./components/primitives/google-tag-manager/gtm-script";
import GoogleTagManagerNoScriptTag from "./components/primitives/google-tag-manager/gtm-noscript";
import { Analytics } from '@vercel/analytics/react';

export const meta: V2_MetaFunction = () => {
  return [
    { title: "A Modio Mio - La vera pizza italiana di Pato Branco" },
    {
      name: "description",
      content: "Bem vindo ao cardápio da Pizza Delivery A Modo Mio",
    },
    {
      name: "keywords",
      content: "pizza, pizza pato branco, pizza em pedaços, pizza al taglio, delivery, pizza delivery, pizza delivery a modo mio, pizzaria pato branco, pizza pato branco, pizza al taglio",
    }
  ];
};

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://api.fonts.coollabs.io" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
  },
  {
    href: "https://api.fonts.coollabs.io/css2?family=Antonio:wght@400;700&family=Inter&family=Montagu+Slab:opsz,wght@16..144,400;16..144,600;16..144,700&display=swap",
    rel: "stylesheet",
  },
  // {
  //   rel: 'apple-touch-icon',
  //   sizes: '180x180',
  //   href: '/favicons/apple-touch-icon.png',
  // },
  // {
  //   rel: 'icon',
  //   type: 'image/png',
  //   sizes: '32x32',
  //   href: '/favicons/favicon-32x32.png',
  // },
  // {
  //   rel: 'icon',
  //   type: 'image/png',
  //   sizes: '32x32',
  //   href: '/favicons/android-chrome-192x192.png',
  // },
  // {
  //   rel: 'icon',
  //   type: 'image/png',
  //   sizes: '32x32',
  //   href: '/favicons/android-chrome-512x512.png',
  // },
  // {
  //   rel: 'icon',
  //   type: 'image/png',
  //   sizes: '16x16',
  //   href: '/favicons/favicon-16x16.png',
  // },
  // { rel: 'manifest', href: '/site.webmanifest' },
  // { rel: 'icon', href: '/favicon.ico' },
];

const GTM_ID = process.env.GOOGLE_TAG_MANAGER_ID

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        <GoogleTagManagerScriptTag id={GTM_ID} />
      </head>
      <body>
        <GoogleTagManagerNoScriptTag id={GTM_ID} />
        <Outlet />
        <Toaster />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        <Analytics />
      </body>
    </html>
  );
}

// export function ErrorBoundary({ error }) {
//   console.error(error);
//   return (
//     <html>
//       <head>
//         <title>Oh no!</title>
//         <Meta />
//         <Links />
//       </head>
//       <body>
//         <div className="m-4 p-4 bg-red-300">
//           <h1>Oh no!</h1>
//           <p className="text-red-700">{error?.message || "Erro generico"}</p>
//         </div>
//         <Scripts />
//       </body>
//     </html>
//   );
// }
