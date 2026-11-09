import { Prisma } from "@prisma/client";
import { type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { formatCompetitorMenuDateTime, isAiqfomeResult } from "~/domain/competitor-menu/competitor-menu-analysis";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Vendas | Concorrência | Coletas" }];

type ActionData = {
  status: number;
  message?: string;
};

export async function loader({}: LoaderFunctionArgs) {
  return {
    snapshots: await prismaClient.competitorMenuSnapshot.findMany({
      select: {
        id: true,
        city: true,
        collectedAt: true,
        restaurantCount: true,
        excludedCount: true,
        originalFileName: true,
      },
      orderBy: { collectedAt: "desc" },
    }),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const intent = String(formData.get("_intent") ?? "upload");

    if (intent === "delete") {
      const snapshotId = String(formData.get("snapshotId") ?? "");
      if (!snapshotId) return badRequest({ message: "Coleta não encontrada." });
      await prismaClient.competitorMenuSnapshot.delete({ where: { id: snapshotId } });
      return ok({ message: "Coleta removida." });
    }

    const file = formData.get("file");
    const pastedJson = String(formData.get("json") ?? "").trim();
    const originalFileName = file instanceof File && file.name ? file.name : null;
    const raw = file instanceof File && file.size > 0 ? await file.text() : pastedJson;

    if (!raw.trim()) return badRequest({ message: "Envie um arquivo JSON ou cole o conteúdo." });

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return badRequest({ message: "JSON inválido. Verifique o arquivo gerado pelo scraper." });
    }

    if (!isAiqfomeResult(payload)) {
      return badRequest({ message: "O JSON não segue a Interface TypeScript do scraper aiqfome." });
    }

    const collectedAt = new Date(payload.metadata.data_coleta);
    if (Number.isNaN(collectedAt.getTime())) {
      return badRequest({ message: "metadata.data_coleta não contém uma data válida." });
    }

    await prismaClient.competitorMenuSnapshot.upsert({
      where: { city_collectedAt: { city: payload.metadata.cidade.trim(), collectedAt } },
      create: {
        city: payload.metadata.cidade.trim(),
        sourceUrl: payload.metadata.fonte,
        collectedAt,
        restaurantCount: payload.metadata.total_incluidos,
        excludedCount: payload.metadata.total_excluidos,
        targetCategories: payload.metadata.filtro_categorias_alvo,
        rawData: payload as unknown as Prisma.InputJsonValue,
        originalFileName,
      },
      update: {
        sourceUrl: payload.metadata.fonte,
        restaurantCount: payload.metadata.total_incluidos,
        excludedCount: payload.metadata.total_excluidos,
        targetCategories: payload.metadata.filtro_categorias_alvo,
        rawData: payload as unknown as Prisma.InputJsonValue,
        originalFileName,
      },
    });

    return ok({ message: "Coleta importada e armazenada." });
  } catch (error) {
    return serverError(error);
  }
}

export default function CompetitorMenuSnapshotsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="flex flex-col gap-6">
      {actionData?.message ? (
        <div
          className={
            actionData.status >= 400
              ? "rounded-md bg-red-50 p-3 text-sm text-red-800"
              : "rounded-md bg-emerald-50 p-3 text-sm text-emerald-800"
          }
        >
          {actionData.message}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Carregar JSON</h2>
          <p className="text-sm text-muted-foreground">
            O JSON completo fica armazenado no banco junto com a data informada em metadata.data_coleta.
          </p>
        </div>
        <Form method="post" encType="multipart/form-data" className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="file">Arquivo JSON do scraper</Label>
            <Input id="file" name="file" type="file" accept=".json,application/json" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="json">Ou cole o JSON</Label>
            <Textarea
              id="json"
              name="json"
              className="min-h-28 font-mono text-xs"
              placeholder='{"metadata": ..., "restaurantes": [...]}'
            />
          </div>
          <Button type="submit" name="_intent" value="upload" className="w-full sm:w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Importando..." : "Importar coleta"}
          </Button>
        </Form>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Histórico de coletas</h2>
          <p className="text-sm text-muted-foreground">Cada registro preserva o JSON bruto recebido do scraper.</p>
        </div>
        <div className="flex flex-col">
          {data.snapshots.map((snapshot, index) => (
            <div key={snapshot.id}>
              <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">
                    {snapshot.city} · {formatCompetitorMenuDateTime(snapshot.collectedAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {snapshot.restaurantCount} concorrentes · {snapshot.excludedCount} excluídos
                    {snapshot.originalFileName ? ` · ${snapshot.originalFileName}` : ""}
                  </div>
                </div>
                <Form
                  method="post"
                  onSubmit={(event) => {
                    if (!window.confirm("Excluir esta coleta e o JSON armazenado?")) event.preventDefault();
                  }}
                >
                  <input type="hidden" name="snapshotId" value={snapshot.id} />
                  <Button
                    type="submit"
                    name="_intent"
                    value="delete"
                    size="sm"
                    variant="destructive"
                    disabled={isSubmitting}
                  >
                    Excluir
                  </Button>
                </Form>
              </div>
              {index < data.snapshots.length - 1 ? <Separator /> : null}
            </div>
          ))}
          {data.snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma coleta importada.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
