import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  useLocation,
} from "@remix-run/react";
import { Toaster } from "./components/ui/toaster";
import stylesheet from "~/tailwind.css?url";
import GoogleTagManagerScriptTag from "./components/primitives/google-tag-manager/gtm-script";
import GoogleTagManagerNoScriptTag from "./components/primitives/google-tag-manager/gtm-noscript";
import { Analytics } from '@vercel/analytics/react';
import { ok } from "./utils/http-response.server";
import { ArrowRight } from "lucide-react";
import Logo from "./components/primitives/logo/logo";
import MicrosoftClarityScriptTag from "./components/primitives/ms-clarity/ms-clarity-script";
import WEBSITE_LINKS from "./domain/website-navigation/links/website-links";
import { useEffect, useState } from "react";

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

export interface EnvironmentVariables {

  MODE: "development" | "production"
  GTM_ID?: string
  CLOUDINARY_CLOUD_NAME?: string
  REST_API_SECRET_KEY?: string
}


export async function loader({ request }: LoaderFunctionArgs) {

  const env = import.meta.env
  const ENV: EnvironmentVariables = {
    MODE: env.VITE_MODE ?? "development",
    GTM_ID: env.VITE_GOOGLE_TAG_MANAGER_ID ?? "",
    CLOUDINARY_CLOUD_NAME: env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
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
        {ENV.MODE === "production" && <MicrosoftClarityScriptTag />}
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
  const location = useLocation();
  const pathname = location?.pathname || "";
  const shouldRedirectCardapio = pathname.startsWith("/cardapio");
  const cardapioFallbackHref = WEBSITE_LINKS.saiposCardapio.href;
  const redirectDelaySeconds = 3;
  const [secondsLeft, setSecondsLeft] = useState(redirectDelaySeconds);

  useEffect(() => {
    if (!shouldRedirectCardapio || typeof window === "undefined") return;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => (current > 1 ? current - 1 : 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [shouldRedirectCardapio]);

  const primaryAction = (() => {
    if (pathname.startsWith("/admin")) return { href: "/admin", label: "Voltar para o painel" };
    if (pathname.startsWith("/cardapio")) return { href: cardapioFallbackHref, label: "Ir para finalizar o pedido" };
    return { href: "/", label: "Ir para a página inicial" };
  })();

  console.log({ error })

  return (
    <html>
      <head>
        <title>Oops!</title>
        {shouldRedirectCardapio ? (
          <meta httpEquiv="refresh" content={`${redirectDelaySeconds};url=${cardapioFallbackHref}`} />
        ) : null}
        <Meta />
        <Links />
      </head>
      <body>
        {shouldRedirectCardapio ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.setTimeout(function () { window.location.replace(${JSON.stringify(cardapioFallbackHref)}); }, ${redirectDelaySeconds * 1000});`,
            }}
          />
        ) : null}
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 text-slate-900">
          <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-10 md:py-16">
            <header className="flex items-center justify-between">
              <Logo onlyText={true} className="w-40 md:w-48" color="black" />
              <div className="rounded-full border border-amber-200 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 shadow-sm">
                Erro inesperado
              </div>
            </header>

            <main className="grid items-center gap-10 rounded-3xl border border-amber-100 bg-white/80 p-8 shadow-[0_20px_70px_rgba(17,24,39,0.08)] backdrop-blur-sm md:p-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">Algo saiu do forno errado</p>
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Desculpe, tivemos um imprevisto.</h1>
                  <p className="text-lg text-slate-600 md:max-w-xl">
                    Ocorreu um erro no cardápio digital. Estamos redirecionando você automaticamente para finalizar seu pedido.
                  </p>
                  {shouldRedirectCardapio ? (
                    <p className="text-sm font-semibold text-slate-800">
                      Redirecionando em {secondsLeft}...
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to={primaryAction.href}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <span>{primaryAction.label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to={shouldRedirectCardapio ? cardapioFallbackHref : "/cardapio"}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    <span>{shouldRedirectCardapio ? "Ir para finalizar o pedido" : "Ver cardápio digital"}</span>
                  </Link>
                </div>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 -z-10 mx-auto h-72 w-72 rounded-full bg-amber-100/70 blur-3xl" aria-hidden />
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-100 bg-white/80 p-6 shadow-inner">
                  <img src="/images/gato-chorando.gif" alt="Gatinho triste" className="w-44 md:w-52" />
                  <div className="text-sm text-slate-500">Prometemos voltar a servir rapidinho.</div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
