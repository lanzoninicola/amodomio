import { Link, Outlet, useLocation } from "@remix-run/react";
import { Option, Settings, Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { lastUrlSegment } from "~/utils/url";



export default function AdminGerenciamentoCardapioSellPriceManagement() {
  const location = useLocation()
  const activeTab = lastUrlSegment(location.pathname)

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="mb-2">Gerenciamento Preços de Vendas Itens</h2>

        <div>


          <Link to="/admin/gerenciamento/cardapio/dna"
            className="flex gap-2 items-center hover:underline hover:cursor-pointer"
          >
            <Settings size={20} />
            <span className="text-[12px] uppercase tracking-wider">DNA Empresa</span>
          </Link>
        </div>

      </div>


      <Alert variant={"destructive"} className="mb-1">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Usar o ponto como delimitador dos decimais
        </AlertDescription>
      </Alert>


      <div className="grid grid-cols-3 items-center">

        <Link to="/admin/gerenciamento/cardapio/sell-price-management/cardapio"
          className="hover:bg-muted my-4"
        >
          <div className={
            cn(
              "flex items-center gap-2 justify-center py-1",
              activeTab === "cardapio" && "bg-muted  font-semibold rounded-md "
            )
          }>
            <Option size={14} />
            <span className="text-[14px]  uppercase tracking-wider font-semibold">Cardapio</span>
          </div>
        </Link>


        <Link to="/admin/gerenciamento/cardapio/sell-price-management/aiqfome"
          className="hover:bg-muted my-4"
        >
          <div className={
            cn(
              "flex items-center gap-2 justify-center py-1",
              activeTab === "aiqfome" && "bg-muted  font-semibold rounded-md "
            )
          }>
            <Option size={14} />
            <span className="text-[14px]  uppercase tracking-wider font-semibold">AiqFome</span>
          </div>
        </Link>

        <Link to="/admin/gerenciamento/cardapio/sell-price-management/ifood"
          className="hover:bg-muted my-4"
        >
          <div className={
            cn(
              "flex items-center gap-2 justify-center py-1",
              activeTab === "ifood" && "bg-muted  font-semibold rounded-md "
            )
          }>
            <Option size={14} />
            <span className="text-[14px]  uppercase tracking-wider font-semibold">IFood</span>
          </div>
        </Link>
      </div>

      <Separator className="my-1" />

      <Outlet />

    </div>
  )
}