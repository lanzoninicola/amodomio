import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { defer } from "@remix-run/node";
import { Await, Form, Link, useLoaderData } from "@remix-run/react";
import { Edit, Search } from "lucide-react";
import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import prisma from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [{ title: "Campanhas | Marketing" }];

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();

  const campaigns = prisma.crmCampaign.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { source: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { created_at: "desc" },
    include: { _count: { select: { sends: true } } },
    take: 100,
  });

  return defer({ campaigns, q });
}

export default function AdminMarketingCampaignIndex() {
  const { campaigns, q } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-3">
      <Form method="get" className="flex flex-wrap items-center gap-3">
        <div className="relative flex min-w-[260px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Pesquise por nome, descrição ou origem"
            className="h-9 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Filtrar
        </button>
      </Form>

      <Suspense
        fallback={
          <div className="py-8 text-sm text-slate-500">
            Carregando campanhas...
          </div>
        }
      >
        <Await
          resolve={campaigns}
          errorElement={
            <div className="py-8 text-sm text-red-700">
              Não foi possível carregar as campanhas.
            </div>
          }
        >
          {(rows) => (
            <>
              <div className="text-sm text-slate-500">
                {rows.length} campanha(s)
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Envios</TableHead>
                      <TableHead>Atualizada em</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length ? (
                      rows.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <Link
                              to={campaign.id}
                              className="font-semibold text-slate-900 hover:text-blue-600"
                            >
                              {campaign.name}
                            </Link>
                            <div className="mt-0.5 max-w-xl truncate text-xs text-slate-500">
                              {campaign.description || "Sem descrição"}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {campaign.source || "-"}
                          </TableCell>
                          <TableCell className="font-medium text-slate-700">
                            {campaign._count.sends}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {formatDate(campaign.updated_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              to={campaign.id}
                              aria-label={`Editar ${campaign.name}`}
                              className="inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Edit size={15} />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-28 text-center text-sm text-slate-500"
                        >
                          Nenhuma campanha encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
