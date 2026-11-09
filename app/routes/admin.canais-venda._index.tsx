import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export async function loader({}: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const channels = await db.itemSellingChannel.findMany({
      include: {
        _count: {
          select: {
            ItemSellingPriceVariation: true,
          },
        },
      },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    });

    return ok({ channels });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminCanaisVendaIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const channels = ((loaderData?.payload as any)?.channels || []) as any[];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>{channels.length} canal(is)</span>
        </div>
        <Link to="/admin/canais-venda/new">
          <Button size="sm" className="h-8 bg-slate-900 text-xs hover:bg-slate-700">
            + Novo canal
          </Button>
        </Link>
      </div>

      <div className="overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Canal</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Chave</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Tipo</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Taxas</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Margem alvo</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Preços vinculados</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel) => (
              <TableRow key={channel.id} className="border-slate-100 hover:bg-slate-50/50">
                <TableCell className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{channel.name}</div>
                    <div className="text-xs text-slate-500">{channel.description || "Sem descrição"}</div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className="font-mono text-xs uppercase text-slate-700">{channel.key}</span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={
                      channel.isMarketplace
                        ? "border-violet-200 bg-violet-50 text-violet-700"
                        : "border-sky-200 bg-sky-50 text-sky-700"
                    }
                  >
                    {channel.isMarketplace ? "Marketplace" : "Canal direto"}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-slate-600">
                  <div>{formatCurrency(channel.feeAmount)} fixo</div>
                  <div>{formatPercent(channel.taxPerc)} + {formatPercent(channel.onlinePaymentTaxPerc)}</div>
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-slate-600">
                  {formatPercent(channel.targetMarginPerc)}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-slate-600">
                  {channel._count?.ItemSellingPriceVariation || 0}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Link to={`/admin/canais-venda/${channel.id}`}>
                    <Button variant="ghost" className="h-7 text-xs text-slate-600 hover:text-slate-900">
                      Editar
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {channels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  Nenhum canal cadastrado.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
