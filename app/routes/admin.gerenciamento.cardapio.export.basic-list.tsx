import { MenuItem, MenuItemGroup } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, defer, useActionData, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import MenuItemList from "~/domain/cardapio/components/menu-item-list/menu-item-list";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import tryit from "~/utils/try-it";
import { MenuItemVisibilityFilterOption } from "./admin.gerenciamento.cardapio.main.list";
import { Separator } from "~/components/ui/separator";
import ExportCsvButton from "~/domain/export-csv/components/export-csv-button/export-csv-button";
import { ArrowDownToLine } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {

  // https://github.com/remix-run/remix/discussions/6149

  // const categories = categoryPrismaEntity.findAll()
  const listFlat = menuItemPrismaEntity.findAll({
    option: {
      sorted: true,
      direction: "asc"
    }
  }, {
    imageTransform: true,
    imageScaleWidth: 64,
  })



  const data = Promise.all([listFlat]);

  return defer({ data });
}

export default function AdminGerenciamentoCardapioExportBasicList() {
  const { data } = useLoaderData<typeof loader>();

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-[150px]">
        <Loading color="black" />
      </div>
    }>
      <Await resolve={data}>
        {([listFlat]) => {


          const [items, setItems] = useState<any[]>([]);

          const [currentFilter, setCurrentFilter] = useState<MenuItemVisibilityFilterOption | null>("active");

          const applyFilters = (
            visibility: MenuItemVisibilityFilterOption | null,
          ) => {
            let filtered = listFlat;




            // Filtro por visibilidade
            if (visibility === "active") {
              filtered = filtered.filter(item => item.active === true && item.upcoming === false);
            }
            if (visibility === "inactive") {
              filtered = filtered.filter(item => item.active === false);
            }
            if (visibility === "lancamento-futuro") {
              filtered = filtered.filter(item => item.active === true && item.upcoming === true);
            }
            if (visibility === "venda-pausada") {
              filtered = filtered.filter(item => item.active === true && item.visible === false && item.upcoming === false);
            }


            setItems(filtered);
          };

          const handleVisibilityChange = (visibility: MenuItemVisibilityFilterOption) => {
            setCurrentFilter(visibility);
            applyFilters(visibility);
          };

          // Primeira renderização
          useEffect(() => {
            applyFilters(currentFilter);
          }, []);

          console.log({ items })


          return (
            <div className="flex flex-col">

              <div className="flex items-center justify-between">
                {/* Select de Visibilidade */}
                <Select
                  onValueChange={(value) => handleVisibilityChange(value as MenuItemVisibilityFilterOption)}
                  defaultValue={"active"}
                >
                  <SelectTrigger className="w-[200px] md:col-span-2">
                    <SelectValue placeholder="Filtrar vendas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Venda ativa</SelectItem>
                    <SelectItem value="lancamento-futuro">Lançamento futuro</SelectItem>
                    <SelectItem value="venda-pausada">Venda pausada</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
                <ExportCsvButton
                  rootUrl={"/admin/export"}
                  context="cardapio-items-basic-list"
                >
                  <div className="flex items-center gap-2">
                    <ArrowDownToLine size={16} />
                    <span className="text-sm">Exportar CSV</span>
                  </div>
                </ExportCsvButton>
              </div>

              <Separator className="my-4" />



              <ul>
                {
                  items.map(i => {
                    return (

                      <li key={i.id} className="grid grid-cols-6 mb-1">
                        <span className="text-sm font-medium">{i.MenuItemGroup?.name}</span>
                        <span className="text-sm font-medium">{i.Category.name}</span>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{i.name}</span>
                          <span className="text-xs">{i.ingredients}</span>
                        </div>
                        <span className="text-sm font-medium">{i.MenuItemSellingPriceVariation.filter(spv => spv.MenuItemSize?.key === "pizza-medium").map(r => (
                          <span key={r.id} className="text-sm font-medium">{r.priceAmount}</span>
                        ))}</span>
                      </li>
                    )
                  })
                }
              </ul>
            </div>
          )
        }}
      </Await >
    </Suspense >
  );
}