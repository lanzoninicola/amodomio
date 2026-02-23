import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import Container from "~/components/layout/container/container";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

interface RecipeSheetListItem {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  isActive: boolean;
  version: number;
  costAmount: number;
  menuItemId: string;
  menuItemSizeId: string;
  menuItemName: string;
  menuItemSizeName: string;
  updatedAt: Date;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const [err, rows] = await tryit(
    prismaClient.recipeSheet.findMany({
      include: {
        MenuItem: { select: { id: true, name: true } },
        MenuItemSize: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    })
  );

  if (err) {
    return serverError(err);
  }

  const recipeSheets: RecipeSheetListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status as RecipeSheetListItem["status"],
    isActive: row.isActive,
    version: row.version,
    costAmount: Number(row.costAmount || 0),
    menuItemId: row.menuItemId,
    menuItemSizeId: row.menuItemSizeId,
    menuItemName: row.MenuItem?.name || "Item desconhecido",
    menuItemSizeName: row.MenuItemSize?.name || "Tamanho desconhecido",
    updatedAt: row.updatedAt,
  }));

  return ok({ recipeSheets });
}

function statusLabel(status: RecipeSheetListItem["status"]) {
  if (status === "active") return "Ativa";
  if (status === "archived") return "Arquivada";
  return "Rascunho";
}

export default function AdminRecipeSheetsIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const recipeSheets = (loaderData?.payload?.recipeSheets || []) as RecipeSheetListItem[];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recipeSheets;

    return recipeSheets.filter((sheet) => {
      return (
        sheet.name.toLowerCase().includes(query) ||
        sheet.menuItemName.toLowerCase().includes(query) ||
        sheet.menuItemSizeName.toLowerCase().includes(query)
      );
    });
  }, [recipeSheets, search]);

  return (
    <Container>
      <div className="flex flex-col gap-4">
        <div className="rounded-md border p-4">
          <Input
            type="search"
            placeholder="Buscar por ficha, item ou tamanho"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <NoRecordsFound text="Nenhuma ficha técnica encontrada" />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {filtered.map((sheet) => (
              <li key={sheet.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{sheet.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {sheet.menuItemName} ({sheet.menuItemSizeName})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      v{sheet.version} • {statusLabel(sheet.status)}
                      {sheet.isActive ? " • Ativa" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Custo: R$ {sheet.costAmount.toFixed(2)}
                    </p>
                  </div>
                  <Link
                    to={`/admin/gerenciamento/cardapio/${sheet.menuItemId}/recipe-sheets?sizeId=${sheet.menuItemSizeId}&sheetId=${sheet.id}`}
                  >
                    <Button type="button" variant="outline" size="sm">
                      Abrir
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
