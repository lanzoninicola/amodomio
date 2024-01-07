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
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
  },
  {
    href: "https://fonts.googleapis.com/css2?family=Antonio:wght@400;700&family=Inter&family=Montagu+Slab:opsz,wght@16..144,400;16..144,600;16..144,700&display=swap",
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

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5F3FPGF9');
`}}></script>
      </head>
      <body>
        <noscript>
          <iframe
            dangerouslySetInnerHTML={{
              __html: `
src="https://www.googletagmanager.com/ns.html?id=GTM-5F3FPGF9"
height="0" width="0" style="display:none;visibility:hidden"
`}}
          ></iframe>
        </noscript>
        <Outlet />
        <Toaster />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
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
