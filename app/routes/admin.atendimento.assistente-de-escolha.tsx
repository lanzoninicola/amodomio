import { Outlet, useLocation } from "@remix-run/react";
import OptionLinkTab from "~/components/option-link-tab/option-link-tab";



export default function AdminAtendimentoDAssistenteDeEscolha() {

  const location = useLocation()

  const rootLocation = '/admin/atendimento/assistente-de-escolha'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Assistente de Escolha</h1>

      <div className="flex gap-8 justify-center">
        <OptionLinkTab href="" label="sabores unicos" highlightCondition={location.pathname === "/admin/atendimento/assistente-de-escolha"} />
        <OptionLinkTab href={`${rootLocation}/pizza-medium`} label="combinações media" highlightCondition={location.pathname === `${rootLocation}/pizza-medium`} />
        <OptionLinkTab href={`${rootLocation}/pizza-bigger`} label="combinações familia" highlightCondition={location.pathname === `${rootLocation}/pizza-bigger`} />
      </div>
      <Outlet />
    </div >
  )
}
