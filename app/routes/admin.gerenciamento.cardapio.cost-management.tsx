import { Link, Outlet } from "@remix-run/react";
import { Settings, Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";



export default function AdminGerenciamentoCardapioCostManagement() {

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2>Gerenciamento Custos Itens</h2>

        <Link to="/admin/gerenciamento/cardapio/cost-management/settings"
          className="flex gap-2 items-center hover:underline hover:cursor-pointer"
        >
          <Settings size={20} />
          <span className="text-[12px] uppercase tracking-wider">Configurações</span>
        </Link>

      </div>

      <Alert variant={"destructive"}>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Usar o ponto como delimitador dos decimais
        </AlertDescription>
      </Alert>

      <Separator className="my-4" />

      <Outlet />

    </div>
  )
}