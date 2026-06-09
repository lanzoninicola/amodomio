import { ArrowRight } from "lucide-react";
import type { MouseEventHandler } from "react";

import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import { cn } from "~/lib/utils";

interface CardapioOrderCtaButtonProps {
  externalLinkURL: string;
  compact?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export default function CardapioOrderCtaButton({
  externalLinkURL,
  compact = false,
  onClick,
}: CardapioOrderCtaButtonProps) {
  return (
    <FazerPedidoButton
      size="sm"
      className={cn(
        "group w-full border border-black px-4 py-0 shadow-[0_2px_0_rgba(0,0,0,0.18)] md:h-12",
        compact ? "h-10 rounded-[1.25rem]" : "h-12 rounded-xl"
      )}
      cnLabel={cn(
        "leading-none tracking-wide font-semibold font-neue md:text-md",
        compact ? "text-xs" : "text-sm"
      )}
      externalLinkURL={externalLinkURL}
      iconRight={<CardapioFooterCtaArrow />}
      onClick={onClick}
    />
  );
}

function CardapioFooterCtaArrow() {
  return (
    <span className="relative h-6 w-7 overflow-hidden" aria-hidden="true">
      <ArrowRight className="absolute inset-y-0 right-0 h-6 w-6 animate-[ctaArrowExit_1.8s_ease-in-out_infinite]" />
      <ArrowRight className="absolute inset-y-0 right-0 h-6 w-6 animate-[ctaArrowEnter_1.8s_ease-in-out_infinite]" />
    </span>
  );
}
