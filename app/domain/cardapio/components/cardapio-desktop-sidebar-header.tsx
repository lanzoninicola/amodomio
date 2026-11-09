import { InstagramLogoIcon } from "@radix-ui/react-icons";
import { Link } from "@remix-run/react";
import { MapPin } from "lucide-react";

import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";

export default function CardapioDesktopSidebarHeader() {
  return (
    <div className="space-y-4">
      <Link to={WEBSITE_LINKS.cardapioPublic.href} className="block w-fit">
        <Logo
          color="black"
          onlyText
          className="h-[50px] w-[150px]"
          tagline={false}
        />
      </Link>

      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-4">
          <ExternalLink
            to={WEBSITE_LINKS.instagram.href}
            aria-label={WEBSITE_LINKS.instagram.title}
            ariaLabel="Link pagina instagram"
          >
            <InstagramLogoIcon color="black" className="h-5 w-5" />
          </ExternalLink>
          <ExternalLink
            to={WEBSITE_LINKS.maps.href}
            aria-label={WEBSITE_LINKS.maps.title}
            ariaLabel="Link para o google maps"
          >
            <MapPin color="black" className="h-5 w-5" />
          </ExternalLink>
        </div>

        <WhatsappExternalLink
          phoneNumber="46991272525"
          ariaLabel="Envia uma mensagem com WhatsApp"
          message={"Olá, gostaria fazer um pedido"}
          className="font-mono text-sm font-semibold"
        >
          (46) 99127-2525
        </WhatsappExternalLink>
      </div>

      <div className="border-b border-zinc-200 pb-4">
        <p className="font-neue text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Horários de funcionamento
        </p>
        <p className="mt-1 font-neue text-sm font-semibold uppercase tracking-wide text-zinc-950">
          Qua a Dom, das 18h às 22h
        </p>
      </div>
    </div>
  );
}
