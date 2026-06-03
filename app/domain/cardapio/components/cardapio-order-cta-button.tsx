import { ArrowRight } from "lucide-react";
import type { MouseEventHandler } from "react";

import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";

interface CardapioOrderCtaButtonProps {
  externalLinkURL: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export default function CardapioOrderCtaButton({
  externalLinkURL,
  onClick,
}: CardapioOrderCtaButtonProps) {
  return (
    <FazerPedidoButton
      size="sm"
      className="group h-12 w-full rounded-xl border border-black px-4 py-0 shadow-[0_2px_0_rgba(0,0,0,0.18)] md:h-12"
      cnLabel="text-sm leading-none tracking-wide font-semibold font-neue md:text-md"
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
