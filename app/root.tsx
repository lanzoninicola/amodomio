import type { LinkDescriptor, LinksFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { Toaster } from "./components/ui/toaster";
import stylesheet from "~/tailwind.css?url";
import GoogleTagManagerScriptTag from "./components/primitives/google-tag-manager/gtm-script";
import GoogleTagManagerNoScriptTag from "./components/primitives/google-tag-manager/gtm-noscript";
import { Analytics } from '@vercel/analytics/react';
import { ok } from "./utils/http-response.server";

export const meta: MetaFunction = () => {
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

const fontsVariants = (font: string) => {
  // const variants = ["Black", "Bold", "Light", "Medium", "Regular", "Semibold", "Thin"]
  const variants = ["Medium"]

  return variants.map(v => `${font}${v}`)
}

const linkFontVariant = (font: string) => {

  return fontsVariants(font).map(variant => {
    return {
      rel: "preload",
      href: `/fonts/${variant}.ttf`,
      as: "font",
      type: "font/ttf",
      crossOrigin: "anonymous",
    }
  })
}


// @ts-ignore
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://api.fonts.coollabs.io" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
  },
  // {
  //   href: "https://api.fonts.coollabs.io/css2?family=Antonio:wght@400;700&family=Inter&family=Montagu+Slab:opsz,wght@16..144,400;16..144,600;16..144,700&display=swap",
  //   rel: "stylesheet",
  // },
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

  // ...linkFontVariant("Lufga"),

];

interface EnvironmentVariables {

  GTM_ID: string
  CLOUDINARY_CLOUD_NAME: string
  STORE_OPENING_CONFIG: {
    OPENING_DAYS: number[]
    OPENING_HOUR: number
    CLOSING_HOUR: number
  }
}


export async function loader({ request }: LoaderFunctionArgs) {

  const ENV: EnvironmentVariables = {
    GTM_ID: process?.env.GOOGLE_TAG_MANAGER_ID ?? "",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    STORE_OPENING_CONFIG: {
      OPENING_DAYS: process.env.STORE_OPEN_DAYWEEK ? process.env.STORE_OPEN_DAYWEEK.split(",").map(Number) : [],
      OPENING_HOUR: process.env?.STORE_OPEN_HH_START ? parseInt(process.env.STORE_OPEN_HH_START) : 1800,
      CLOSING_HOUR: process.env?.STORE_OPEN_HH_END ? parseInt(process.env.STORE_OPEN_HH_END) : 1800,
    }
  }

  return ok({
    env: ENV
  })
}

export default function App() {
  const loaderData = useLoaderData<typeof loader>()
  const ENV: EnvironmentVariables = loaderData?.payload?.env



  return (
    <html lang="pt-br" className="scroll-smooth">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        {ENV.GTM_ID !== "" && <GoogleTagManagerScriptTag id={ENV.GTM_ID} />}
      </head>
      <body>
        <script src="https://upload-widget.cloudinary.com/latest/global/all.js" type="text/javascript" />
        <Outlet />
        <Toaster />
        <ScrollRestoration />
        <Scripts />
        <Analytics />
        {ENV.GTM_ID !== "" && <GoogleTagManagerNoScriptTag id={ENV.GTM_ID} />}
      </body>
    </html>
  );
}




export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <html>
      <head>
        <title>Oops!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>
          {isRouteErrorResponse(error)
            ? `${error.status} ${error.statusText}`
            : error instanceof Error
              ? error.message
              : "Unknown Error"}
        </h1>
        <Scripts />
      </body>
    </html>
  );
}
