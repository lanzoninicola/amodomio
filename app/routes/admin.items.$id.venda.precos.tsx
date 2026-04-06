import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useActionData, useLoaderData, useLocation, useOutletContext } from "@remix-run/react";
import { Eye, Pencil } from "lucide-react";
import { useEffect } from "react";
import { toast } from "~/components/ui/use-toast";
import { itemSellingPriceVariationEntity } from "~/domain/item/item-selling-price-variation.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";
import type { AdminItemVendaOutletContext } from "./admin.items.$id.venda";

function parseMoneyInput(value: FormDataEntryValue | null) {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

const pricesNavigation = [
  { name: "Visualizar", href: "visualizar", icon: Eye },
  { name: "Editar", href: "editar", icon: Pencil },
];

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const db = prismaClient as any;
    const [item, editableVariations, nativeRows, nativeModelAvailable] = await Promise.all([
      db.item.findUnique({
        where: { id },
        select: { id: true, name: true },
      }),
      db.itemVariation.findMany({
        where: { itemId: id, deletedAt: null },
        select: {
          id: true,
          isReference: true,
          Variation: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      itemSellingPriceVariationEntity.findManyByItemId(id),
      itemSellingPriceVariationEntity.isAvailable(),
    ]);

    if (!item) return badRequest("Item não encontrado");

    return ok({
      item,
      editableVariations,
      nativeRows,
      nativeModelAvailable,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "");

    if (actionName !== "upsert-native-price") {
      return badRequest("Ação inválida");
    }

    const nativeModelAvailable = await itemSellingPriceVariationEntity.isAvailable();
    if (!nativeModelAvailable) {
      return badRequest("Modelo nativo de venda ainda não disponível no Prisma Client desta execução.");
    }

    const itemVariationId = String(formData.get("itemVariationId") || "").trim();
    const itemSellingChannelId = String(formData.get("itemSellingChannelId") || "").trim();
    const updatedBy = String(formData.get("updatedBy") || "").trim() || null;
    const published = String(formData.get("published") || "") === "on";
    const priceAmount = parseMoneyInput(formData.get("priceAmount"));

    if (!itemVariationId) return badRequest("Variação inválida");
    if (!itemSellingChannelId) return badRequest("Canal inválido");
    if (priceAmount == null) return badRequest("Preço inválido");

    const db = prismaClient as any;
    const itemChannel = await db.itemSellingChannelItem.findFirst({
      where: {
        itemId,
        itemSellingChannelId,
      },
      select: {
        id: true,
      },
    });

    if (!itemChannel) {
      return badRequest("Este item não está habilitado para o canal selecionado.");
    }

    await itemSellingPriceVariationEntity.upsert({
      itemId,
      itemVariationId,
      itemSellingChannelId,
      priceAmount,
      published,
      updatedBy,
    });

    return ok("Preço nativo do item salvo.");
  } catch (error) {
    return serverError(error);
  }
}

export type AdminItemVendaPrecosOutletContext = AdminItemVendaOutletContext & {
  editableVariations: Array<{
    id: string;
    isReference: boolean;
    Variation?: {
      id: string;
      code: string;
      name: string;
    } | null;
  }>;
  nativeRows: Array<{
    id: string;
    itemVariationId: string;
    itemSellingChannelId: string;
    priceAmount: number;
    published: boolean;
  }>;
  nativeModelAvailable: boolean;
};

export default function AdminItemVendaPrecosLayout() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const sellingContext = useOutletContext<AdminItemVendaOutletContext>();
  const location = useLocation();
  const activeSubtab = lastUrlSegment(location.pathname);
  const payload = (loaderData?.payload || {}) as {
    editableVariations?: AdminItemVendaPrecosOutletContext["editableVariations"];
    nativeRows?: AdminItemVendaPrecosOutletContext["nativeRows"];
    nativeModelAvailable?: boolean;
  };
  const basePath = `/admin/items/${sellingContext.item.id}/venda/precos`;

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }

    if (actionData?.status && actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
    }
  }, [actionData]);

  const outletContext: AdminItemVendaPrecosOutletContext = {
    ...sellingContext,
    editableVariations: payload.editableVariations || [],
    nativeRows: payload.nativeRows || [],
    nativeModelAvailable: payload.nativeModelAvailable ?? false,
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-950">Preços</h2>
        <nav className="border-b border-slate-100">
          <div className="flex items-center gap-5 overflow-x-auto text-sm">
            {pricesNavigation.map((navItem) => {
              const Icon = navItem.icon;
              const isActive = activeSubtab === navItem.href;

              return (
                <Link
                  key={navItem.href}
                  to={`${basePath}/${navItem.href}`}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 pb-2.5 font-medium transition ${
                    isActive
                      ? "border-slate-950 text-slate-950"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Icon size={14} />
                  {navItem.name}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <Outlet context={outletContext} />
    </div>
  );
}
