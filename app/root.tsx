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
import { Button } from "./components/ui/button";
import PUBLIC_WEBSITE_NAVIGATION_ITEMS from "./domain/website-navigation/public/public-website.nav-links";
import GLOBAL_LINKS from "./domain/website-navigation/global-links.constant";
import ExternalLink from "./components/primitives/external-link/external-link";
import { cn } from "./lib/utils";
import { ArrowRight } from "lucide-react";
import Logo from "./components/primitives/logo/logo";

export const meta: MetaFunction = () => {
  return [
    { title: "Pizza Delivery Italiana em Pato Branco - A Modo Mio" },
    {
      name: "description",
      content: "Experimente a autêntica pizza italiana da A Modo Mio em Pato Branco. Crocante, artesanal e irresistível. Peça agora!",
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
    href: "https://fonts.googleapis.com/css2?family=Inter&family=Montagu+Slab:opsz,wght@16..144,400;16..144,600;16..144,700&display=swap",
    rel: "preload",
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

  const env = import.meta.env

  const ENV: EnvironmentVariables = {
    GTM_ID: env.VITE_GOOGLE_TAG_MANAGER_ID ?? "",
    CLOUDINARY_CLOUD_NAME: env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
    STORE_OPENING_CONFIG: {
      OPENING_DAYS: env.VITE_STORE_OPEN_DAYWEEK ? env.VITE_STORE_OPEN_DAYWEEK.split(",").map(Number) : [],
      OPENING_HOUR: env?.STORE_OPEN_HH_START ? parseInt(env.VITE_STORE_OPEN_HH_START) : 1800,
      CLOSING_HOUR: env?.STORE_OPEN_HH_END ? parseInt(env.VITE_STORE_OPEN_HH_END) : 1800,
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
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <Meta />
        <Links />
        {ENV.GTM_ID !== "" && <GoogleTagManagerScriptTag id={ENV.GTM_ID} />}
      </head>
      <body>

        <Outlet />
        <Toaster />
        <ScrollRestoration />
        <Scripts />
        <script src="https://upload-widget.cloudinary.com/latest/global/all.js" type="text/javascript" />
        <Analytics />
        {ENV.GTM_ID !== "" && <GoogleTagManagerNoScriptTag id={ENV.GTM_ID} />}
      </body>
    </html>
  );
}




export function ErrorBoundary() {
  const error = useRouteError();

  console.log({ error })

  return (
    <html>
      <head>
        <title>Oops!</title>
        <Meta />
        <Links />
      </head>
      <body>
        {/* <h1>
          {isRouteErrorResponse(error)
            ? `${error.status} ${error.statusText}`
            : error instanceof Error
              ? error.message
              : "Unknown Error"}
        </h1> */}
        <div className="w-screen h-screen">
          <div className="grid grid-rows-6 w-full h-full items-center justify-center">
            <Logo onlyText={true} className="w-full h-full px-32 flex row-span-2" color="black" />
            <div className="flex flex-col items-center row-span-2" >
              <div className="flex flex-col ">
                <h1 className="font-thin leading-none text-6xl md:text-7xl">Desculpe</h1>
                <h2 className="font-semibold text-xl">mas alguma coisa deu errado.</h2>
              </div>
              <img src="/images/gato-chorando.gif" alt="Erro" className="h-64" />
            </div>
            <div className="flex flex-col items-center justify-center gap-2">
              <ExternalLink
                to={GLOBAL_LINKS.mogoCardapio.href}
                ariaLabel="Cardápio digital pizzaria A Modo Mio"
              >
                <div className='flex gap-2 items-center justify-between px-4 py-2 bg-black rounded-lg'>
                  <span className={
                    cn(
                      "uppercase tracking-wide font-semibold text-white",
                    )
                  }>
                    Visualizar o cardápio
                  </span>
                  <ArrowRight color="white" />
                </div>
              </ExternalLink>

            </div>


          </div>

        </div>
        <Scripts />
      </body>
    </html>
  );
}
