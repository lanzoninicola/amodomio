import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Suspense } from "react";
import OptionTab from "~/components/layout/option-tab/option-tab";
import Loading from "~/components/loading/loading";
import OptionLinkTab from "~/components/option-link-tab/option-link-tab";
import Toooltip from "~/components/tooltip/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Tooltip } from "~/components/ui/tooltip";
import { authenticator } from "~/domain/auth/google.server";
import { MenuItemSellingPriceHandler, menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";



export default function AdminAtendimentoDAssistenteDeEscolha() {

  const location = useLocation()

  const rootLocation = '/admin/atendimento/assistente-de-escolha'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Assistente de Escolha</h1>

      <div className="flex gap-8 justify-center">
        <OptionLinkTab href="" label="sabores unicos" highlightCondition={location.pathname === "/admin/atendimento/assistente-de-escolha"} />
        <OptionLinkTab href={`${rootLocation}/pizza-medium`} label="pizza media" highlightCondition={location.pathname === `${rootLocation}/pizza-medium`} />
        <OptionLinkTab href={`${rootLocation}/pizza-bigger`} label="pizza familia" highlightCondition={location.pathname === `${rootLocation}/pizza-bigger`} />
      </div>
      <Outlet />
    </div >
  )
}
