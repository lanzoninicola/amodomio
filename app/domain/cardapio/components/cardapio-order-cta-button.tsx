import { ArrowRight } from "lucide-react";
import type { MouseEventHandler } from "react";

import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import { cn } from "~/lib/utils";

interface CardapioOrderCtaButtonProps {
  externalLinkURL: string;
  compact?: boolean;
  headerCompact?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export default function CardapioOrderCtaButton({
  externalLinkURL,
  compact = false,
  headerCompact = false,
  onClick,
}: CardapioOrderCtaButtonProps) {
  return (
    <FazerPedidoButton
      size="sm"
      variant={headerCompact ? "secondary" : "primary"}
      className={cn(
        "group w-full border border-black px-4 py-0 shadow-[0_2px_0_rgba(0,0,0,0.18)] md:h-12",
        headerCompact
          ? "h-8 rounded-full px-3 shadow-sm"
          : compact
          ? "h-10 rounded-[1.25rem]"
          : "h-12 rounded-xl"
      )}
      cnLabel={cn(
        "whitespace-nowrap leading-none tracking-wide font-semibold font-neue md:text-md",
        headerCompact
          ? "inline-flex h-full items-center justify-center pt-px text-[11px]"
          : compact
          ? "text-xs"
          : "text-sm"
      )}
      externalLinkURL={externalLinkURL}
      iconRight={headerCompact ? <></> : <CardapioFooterCtaArrow />}
      onClick={onClick}
    />
  );
}

function CardapioFooterCtaArrow({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "relative overflow-hidden",
        compact ? "h-4 w-4" : "h-6 w-7"
      )}
      aria-hidden="true"
    >
      <ArrowRight
        className={cn(
          "absolute inset-y-0 right-0 animate-[ctaArrowExit_1.8s_ease-in-out_infinite]",
          compact ? "h-4 w-4" : "h-6 w-6"
        )}
      />
      <ArrowRight
        className={cn(
          "absolute inset-y-0 right-0 animate-[ctaArrowEnter_1.8s_ease-in-out_infinite]",
          compact ? "h-4 w-4" : "h-6 w-6"
        )}
      />
    </span>
  );
}
