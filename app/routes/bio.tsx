import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { defer } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import {
  ArrowUpRight,
  Clock3,
  Instagram,
  MapPin,
  Maximize2,
  MessageCircle,
  Play,
  Pizza,
} from "lucide-react";
import { useEffect, useRef } from "react";

import Logo from "~/components/primitives/logo/logo";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import CardapioFacebookPixel from "~/domain/cardapio/components/cardapio-facebook-pixel";
import type { CardapioFeatured } from "~/domain/cardapio/cardapio-featured.server";
import { trackCardapioFacebookPixelTrigger } from "~/domain/cardapio/facebook-pixel.client";
import {
  trackBioLinkClick,
  trackBioPageView,
  trackCardapioFeatured,
} from "~/domain/cardapio/tracking/cardapio-tracking.client";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";

const ORDER_URL_SETTING = "fazer_pedido.public.url";

export const meta: MetaFunction = () => [
  { title: "A Modo Mio | Pizza italiana em Pato Branco" },
  {
    name: "description",
    content:
      "Cardápio, pedidos, Instagram e localização da pizzaria A Modo Mio.",
  },
  { name: "og:title", content: "A Modo Mio | Nossos links" },
  {
    name: "og:description",
    content: "É a pizza! Italiana! Encontre tudo da A Modo Mio em um só lugar.",
  },
  {
    name: "og:image",
    content: "https://www.amodomio.com.br/images/cardapio_og_image.jpg",
  },
  { name: "og:url", content: "https://www.amodomio.com.br/bio" },
  { name: "og:type", content: "website" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  let orderUrl = WEBSITE_LINKS.cardapioFallbackURL.href;

  try {
    const setting = await prismaClient.setting.findFirst({
      where: {
        context: "cardapio",
        name: ORDER_URL_SETTING,
      },
      select: { value: true },
      orderBy: { createdAt: "desc" },
    });

    if (setting?.value?.trim()) orderUrl = setting.value.trim();
  } catch (error) {
    console.error("[bio] order URL load failed, using fallback", error);
  }

  const [
    { getFacebookPixelRuntimeConfigForPath },
    { findPublishedCardapioFeatured },
  ] = await Promise.all([
    import("~/domain/cardapio/facebook-pixel.server"),
    import("~/domain/cardapio/cardapio-featured.server"),
  ]);
  const { readBioSettings } = await import("~/domain/bio/bio-settings.server");
  const [facebookPixel, featuredSections, bioSettings] = await Promise.all([
    getFacebookPixelRuntimeConfigForPath(new URL(request.url).pathname),
    findPublishedCardapioFeatured(),
    readBioSettings().catch((error) => {
      console.error("[bio] text settings load failed, using defaults", error);
      return {
        headline: "É a pizza! Italiana!",
        description: "Pizza italiana com personalidade, feita em Pato Branco.",
      };
    }),
  ]);

  return defer({ orderUrl, facebookPixel, featuredSections, bioSettings });
}

type BioLinkProps = {
  title: string;
  description: string;
  href: string;
  icon: typeof Pizza;
  accent: string;
  external?: boolean;
  trackingDestination: string;
  onTrack?: () => void;
};

function BioLink({
  title,
  description,
  href,
  icon: Icon,
  accent,
  external = false,
  trackingDestination,
  onTrack,
}: BioLinkProps) {
  const trackClick = () => {
    trackBioLinkClick(trackingDestination);
    onTrack?.();
  };
  const content = (
    <>
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-zinc-950 ring-1 ring-black/5",
          accent
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.3} />
      </span>

      <span className="min-w-0 flex-1 text-left">
        <span className="block font-neue text-[15px] font-bold uppercase leading-tight tracking-wide text-zinc-950">
          {title}
        </span>
        <span className="mt-1 block font-neue text-xs leading-snug text-zinc-500">
          {description}
        </span>
      </span>

      <ArrowUpRight
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-950"
      />
    </>
  );
  const className =
    "group flex min-h-[76px] w-full items-center gap-3 rounded-[22px] border border-black/10 bg-white/95 p-3 shadow-[0_10px_30px_rgba(24,24,27,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(24,24,27,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 active:scale-[0.99]";

  if (external) {
    return (
      <a
        className={className}
        href={href}
        rel="noreferrer"
        target="_blank"
        onClick={trackClick}
      >
        {content}
      </a>
    );
  }

  return (
    <Link className={className} to={href} onClick={trackClick}>
      {content}
    </Link>
  );
}

function BioPublicationCard({ section }: { section: CardapioFeatured }) {
  const cardRef = useRef<HTMLElement>(null);
  const media = section.images[0];
  const isVideo = media?.kind === "video";
  const href =
    media?.chipAction !== "none" && media?.chipAction !== "modal"
      ? media?.linkUrl
      : null;
  const opensNewTab = media?.linkNewTab !== false;

  useEffect(() => {
    const element = cardRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        trackCardapioFeatured({
          action: "impression",
          sectionKey: section.key,
          imageIndex: 0,
          placement: "bio_card",
        });
        observer.disconnect();
      },
      { threshold: 0.5 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [section.key]);

  if (!media) return null;

  const trackClick = () => {
    trackBioLinkClick(`publicacao:${section.key}`);
    trackCardapioFeatured({
      action: "cta_click",
      sectionKey: section.key,
      imageIndex: 0,
      placement: "bio_card",
    });
  };
  const openMedia = () => {
    trackCardapioFeatured({
      action: "expand",
      sectionKey: section.key,
      imageIndex: 0,
      placement: "bio_card",
    });
  };
  const text = (
    <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3 text-left">
      <span className="font-lora text-[17px] font-bold leading-tight text-zinc-950">
        {section.title}
      </span>
      {section.subtitle ? (
        <span className="mt-1.5 line-clamp-3 font-neue text-xs leading-snug text-zinc-600">
          {section.subtitle}
        </span>
      ) : null}
      <span className="mt-2 inline-flex items-center gap-1 font-neue text-[10px] font-bold uppercase tracking-wide text-zinc-500">
        {media.linkText || section.promotionHintText || "Ver publicação"}
        {href ? <ArrowUpRight aria-hidden="true" className="h-3 w-3" /> : null}
      </span>
    </span>
  );

  return (
    <article
      ref={cardRef}
      className="group flex min-h-[116px] w-full overflow-hidden rounded-[22px] border border-black/10 bg-white/95 shadow-[0_10px_30px_rgba(24,24,27,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(24,24,27,0.13)]"
    >
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            onClick={openMedia}
            className="relative block h-[116px] w-[108px] shrink-0 cursor-zoom-in overflow-hidden bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:w-[120px]"
            aria-label={`Ampliar ${
              isVideo ? "vídeo" : "imagem"
            } da publicação ${section.title}`}
          >
            {isVideo ? (
              <video
                src={media.imageUrl}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={media.alt || `Vídeo da publicação ${section.title}`}
              />
            ) : (
              <img
                src={media.imageUrl}
                alt={media.alt || `Imagem da publicação ${section.title}`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}

            {isVideo ? (
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-1 font-neue text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                <Play aria-hidden="true" className="h-2.5 w-2.5 fill-current" />
                Vídeo
              </span>
            ) : null}
            <span className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white backdrop-blur-sm">
              <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
          </button>
        </DialogTrigger>
        <DialogContent className="flex h-[100dvh] w-screen max-w-none items-center justify-center border-0 bg-black p-0 text-white sm:max-w-none [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-white/90 [&>button]:p-2 [&>button]:text-black [&>button]:opacity-100">
          <DialogTitle className="sr-only">{section.title}</DialogTitle>
          {isVideo ? (
            <video
              src={media.fullscreenImageUrl || media.imageUrl}
              className="max-h-[100dvh] max-w-full object-contain"
              autoPlay
              controls
              playsInline
              aria-label={media.alt || `Vídeo da publicação ${section.title}`}
            />
          ) : (
            <img
              src={media.fullscreenImageUrl || media.imageUrl}
              alt={media.alt || `Imagem da publicação ${section.title}`}
              className="max-h-[100dvh] max-w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {href ? (
        <a
          href={href}
          target={opensNewTab ? "_blank" : undefined}
          rel={opensNewTab ? "noreferrer" : undefined}
          className="flex min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950"
          onClick={trackClick}
        >
          {text}
        </a>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              onClick={openMedia}
              className="flex min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950"
            >
              {text}
            </button>
          </DialogTrigger>
          <DialogContent className="flex h-[100dvh] w-screen max-w-none items-center justify-center border-0 bg-black p-0 text-white sm:max-w-none [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-white/90 [&>button]:p-2 [&>button]:text-black [&>button]:opacity-100">
            <DialogTitle className="sr-only">{section.title}</DialogTitle>
            {isVideo ? (
              <video
                src={media.fullscreenImageUrl || media.imageUrl}
                className="max-h-[100dvh] max-w-full object-contain"
                autoPlay
                controls
                playsInline
                aria-label={media.alt || `Vídeo da publicação ${section.title}`}
              />
            ) : (
              <img
                src={media.fullscreenImageUrl || media.imageUrl}
                alt={media.alt || `Imagem da publicação ${section.title}`}
                className="max-h-[100dvh] max-w-full object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}

export default function BioPage() {
  const { orderUrl, facebookPixel, featuredSections, bioSettings } =
    useLoaderData<typeof loader>();
  const pageViewTracked = useRef(false);

  useEffect(() => {
    if (pageViewTracked.current) return;
    pageViewTracked.current = true;
    trackBioPageView();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#faf9f6] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] text-zinc-950">
      {facebookPixel ? <CardapioFacebookPixel config={facebookPixel} /> : null}
      <div
        aria-hidden="true"
        className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#d8a1ff]/55 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 top-44 h-72 w-72 rounded-full bg-[#ffe64d]/55 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[#8de1d1]/50 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-md flex-col items-center">
        <header className="flex w-full flex-col items-center text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-zinc-950 p-2 shadow-[0_16px_40px_rgba(24,24,27,0.2)] ring-4 ring-white/80">
            <Logo circle color="white" className="bg-transparent p-0" />
          </div>

          <Logo
            onlyText
            tagline={false}
            color="black"
            className="mt-2 h-auto w-52"
          />

          <p className="mt-1 max-w-xs font-lora text-xl font-bold leading-snug tracking-tight">
            {bioSettings.headline}
          </p>
          <p className="mt-2 max-w-sm font-neue text-sm leading-relaxed text-zinc-600">
            {bioSettings.description}
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 font-neue text-[11px] font-semibold uppercase tracking-wide text-zinc-600 backdrop-blur">
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
            Quarta a domingo · 18h às 22h
          </div>
        </header>

        <nav aria-label="Links da A Modo Mio" className="mt-8 w-full space-y-3">
          <BioLink
            title="Ver nosso cardápio"
            description="Conheça os sabores e escolha sua pizza"
            href={WEBSITE_LINKS.cardapioPublic.href}
            icon={Pizza}
            accent="bg-[#ffe64d]"
            trackingDestination="cardapio"
          />

          {featuredSections.length > 0 ? (
            <section aria-label="Publicações em destaque" className="pt-3">
              <div className="space-y-3">
                {featuredSections.map((section) => (
                  <BioPublicationCard key={section.id} section={section} />
                ))}
              </div>
            </section>
          ) : null}

          <BioLink
            title="Fazer pedido"
            description="Peça agora pelo nosso canal de atendimento"
            href={orderUrl}
            icon={MessageCircle}
            accent="bg-[#8de1d1]"
            external
            trackingDestination="fazer_pedido"
            onTrack={() =>
              trackCardapioFacebookPixelTrigger("fazer_pedido_click", {
                source: "bio",
              })
            }
          />
          <BioLink
            title="Instagram"
            description="Novidades, bastidores e muita pizza"
            href={WEBSITE_LINKS.instagram.href}
            icon={Instagram}
            accent="bg-[#d8a1ff]"
            external
            trackingDestination="instagram"
          />
          <BioLink
            title="Como chegar"
            description="Abra nossa localização no Google Maps"
            href={WEBSITE_LINKS.maps.href}
            icon={MapPin}
            accent="bg-[#ff9f8f]"
            external
            trackingDestination="maps"
          />
        </nav>

        <footer className="mt-8 font-neue text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          A Modo Mio · Pato Branco, PR
        </footer>
      </div>
    </main>
  );
}
