import { ActionFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Await, Form, Link, Outlet, defer, useActionData, useLoaderData, useLocation } from "@remix-run/react";
import { ArrowUp, Option, Settings, Terminal } from "lucide-react";
import { c } from "node_modules/vite/dist/node/types.d-aGj9QkWt";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { SellingChannelKey, menuItemSellingChannelPrismaEntity } from "~/domain/cardapio/menu-item-selling-channel.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";
import { json } from "@remix-run/node";
import { Suspense, useState, useTransition } from "react";
import Loading from "~/components/loading/loading";
import { MenuItemSellingChannel } from "@prisma/client";
import SubmitButton from "~/components/primitives/submit-button/submit-button";

interface TabProps {
  to: string;
  cnContainer?: string;
  label: string;
  channelKey: string;
  children?: React.ReactNode;
}

export async function loader({ request }: LoaderFunctionArgs) {

  const sellingChannel = menuItemSellingChannelPrismaEntity.findAll();

  return defer(
    {
      sellingChannel,
    }
  )
}


type ActionData = {
  errors?: {
    targetMarginPerc?: string;
  };
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const channelKey = formData.get("channelKey") as SellingChannelKey;
  const targetMarginPerc = formData.get("targetMarginPerc");

  let errors: ActionData["errors"] = {};
  if (!targetMarginPerc || isNaN(Number(targetMarginPerc))) {
    errors.targetMarginPerc = "Valor inválido para margem desejada";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  const sellingChannelRecord = await menuItemSellingChannelPrismaEntity.findOneByKey(channelKey)

  if (!sellingChannelRecord) {
    // create the record
    return badRequest(`Can not find selling channel with key ${channelKey}`);
  }

  // Atualize o registro no banco de dados (exemplo: atualizando o registro com id 1)
  const [err, record] = await prismaIt(menuItemSellingChannelPrismaEntity.update({
    where: { id: sellingChannelRecord.id },
    data: {
      targetMarginPerc: Number(targetMarginPerc),
    },
  }))

  if (err) {
    return badRequest(err);
  }

  return ok('Atualizado'); // Redireciona para uma página de sucesso
};

export default function AdminGerenciamentoCardapioSellPriceManagement() {
  const location = useLocation()
  const activeTab = lastUrlSegment(location.pathname)

  const { sellingChannel } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [isPending, startTransition] = useTransition()



  const Tab = ({ to, cnContainer, channelKey, label, children }: TabProps) => {
    return (
      <div className={
        cn(
          "hover:bg-muted flex flex-col border rounded-md p-2 my-4",
          activeTab === channelKey && "bg-slate-200",
          cnContainer
        )
      }>
        <Link to={to}>
          <div className="flex items-center gap-2 justify-center py-1">
            <Option size={14} />
            <span className="text-[14px]  uppercase tracking-wider font-semibold">{label}</span>
          </div>
        </Link>
        {children}
      </div>
    )
  }


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






      <div className="grid grid-cols-3 gap-x-2 items-center">

        <Suspense fallback={<Loading />}>
          <Await resolve={sellingChannel}>
            {(sellingChannel) => {
              {
                return sellingChannel.map(
                  (channel: MenuItemSellingChannel) => {
                    return (
                      <Tab
                        to={`/admin/gerenciamento/cardapio/sell-price-management/${channel.key}/list`}
                        key={channel.key}
                        channelKey={channel.key}
                        label={channel.name}
                      >


                        <Form method="post" className="flex justify-center gap-4 items-center ">
                          <input type="hidden" name="channelKey" defaultValue={channel.key} />
                          <span className="text-muted-foreground text-[11px]">
                            Profito Desejado (%)
                          </span>
                          <NumericInput name="targetMarginPerc" defaultValue={channel.targetMarginPerc} className="w-16" />
                          {actionData?.errors?.targetMarginPerc && (
                            <span className="text-red-500 text-xs">
                              {actionData.errors.targetMarginPerc}
                            </span>
                          )}
                          <SubmitButton
                            actionName="selling-channel-target-margin-perc-update"
                            disabled={isPending === true}
                            onlyIcon={true}
                          >
                            {isPending === true ? "Salvando..." : "Salvar"}
                          </SubmitButton>
                        </Form>
                      </Tab>
                    )
                  }
                )
              }
            }
            }
          </Await>
        </Suspense>

      </div>

      <Separator className="my-1" />

      {/* <div className="grid place-items-center min-h-[250px]">
        <div className="flex flex-col gap-2 justify-center items-center">
          <ArrowUp className="text-muted-foreground" size={40} />
          <p className="font-semibold text-sm tracking-wider text-muted-foreground">Seleciona o canal de venda desejado aqui acima</p>
        </div>
      </div> */}

      <Outlet />

    </div>
  )
}


