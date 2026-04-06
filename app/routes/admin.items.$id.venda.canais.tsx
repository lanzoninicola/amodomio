import type { ActionFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useOutletContext } from "@remix-run/react";
import { Switch } from "~/components/ui/switch";
import type { AdminItemVendaOutletContext } from "./admin.items.$id.venda";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const db = prismaClient as any;
    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "");

    if (actionName !== "toggle-item-channel" && actionName !== "toggle-item-channel-visible") {
      return badRequest("Ação inválida");
    }

    const itemSellingChannelId = String(formData.get("itemSellingChannelId") || "").trim();
    if (!itemSellingChannelId) return badRequest("Canal inválido");

    const [item, channel] = await Promise.all([
      db.item.findUnique({ where: { id: itemId }, select: { id: true, name: true } }),
      db.itemSellingChannel.findUnique({ where: { id: itemSellingChannelId }, select: { id: true, name: true } }),
    ]);

    if (!item) return badRequest("Item não encontrado");
    if (!channel) return badRequest("Canal não encontrado");

    if (actionName === "toggle-item-channel-visible") {
      const visible = String(formData.get("visible") || "").trim() === "true";
      const channelItem = await db.itemSellingChannelItem.findFirst({
        where: {
          itemId,
          itemSellingChannelId,
        },
        select: {
          id: true,
        },
      });

      if (!channelItem) {
        return badRequest("Vincule o item ao canal antes de controlar a visibilidade.");
      }

      await db.itemSellingChannelItem.update({
        where: {
          id: channelItem.id,
        },
        data: {
          visible,
        },
      });

      return ok(
        visible
          ? `Item marcado como visível no canal ${channel.name}.`
          : `Item ocultado no canal ${channel.name}.`
      );
    }

    const enabled = String(formData.get("enabled") || "").trim() === "true";

    if (enabled) {
      await db.itemSellingChannelItem.upsert({
        where: {
          itemId_itemSellingChannelId: {
            itemId,
            itemSellingChannelId,
          },
        },
        update: {},
        create: {
          itemId,
          itemSellingChannelId,
          visible: false,
        },
      });

      return ok(`Item vinculado ao canal ${channel.name}.`);
    }

    const connectedPriceCount =
      typeof db.itemSellingPriceVariation?.count === "function"
        ? await db.itemSellingPriceVariation.count({
            where: {
              itemId,
              itemSellingChannelId,
            },
          })
        : 0;

    if (connectedPriceCount > 0) {
      return badRequest(
        `Nao foi possivel remover do canal ${channel.name}: existem ${connectedPriceCount} preco(s) conectado(s). Use a visibilidade do canal.`
      );
    }

    await db.itemSellingChannelItem.deleteMany({
      where: {
        itemId,
        itemSellingChannelId,
      },
    });

    return ok(`Item desvinculado do canal ${channel.name}.`);
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemVendaCanaisRoute() {
  const actionData = useActionData<typeof action>();
  const { channels, legacyPublications } = useOutletContext<AdminItemVendaOutletContext>();
  const enabledChannels = channels.filter((channel) => channel.enabledForItem);

  return (
    <div className="space-y-4">
      {actionData?.message ? (
        <div className={`rounded-md border px-3 py-2 text-sm ${actionData.status >= 400 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {actionData.message}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Disponibilidade por canal</h2>
        <p className="mt-1 text-sm text-slate-600">
          Aqui você define em quais canais este item entra. Isso passa a dirigir a visibilidade pública e a edição de preços por canal.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>{enabledChannels.length} canal(is) habilitado(s)</span>
          {enabledChannels.length > 0 ? (
            <span>
              · {enabledChannels.map((channel) => channel.name).join(", ")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {channels.map((channel) => (
          <section key={channel.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{channel.name}</h3>
                {channel.description ? (
                  <p className="mt-1 text-xs text-slate-600">{channel.description}</p>
                ) : null}
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  channel.enabledForItem
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {channel.enabledForItem ? "Item no canal" : "Item fora do canal"}
              </span>
            </div>

            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Chave</dt>
                <dd className="font-mono text-xs uppercase">{channel.key}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Nome no banco</dt>
                <dd className="text-right">{channel.dbName || "-"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Cadastro do canal</dt>
                <dd>{channel.isConfigured ? "Configurado" : "Sem cadastro"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Taxa fixa</dt>
                <dd>{formatCurrency(channel.feeAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Taxa %</dt>
                <dd>{formatPercent(channel.taxPerc)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Pagamento online</dt>
                <dd>{formatPercent(channel.onlinePaymentTaxPerc)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Margem alvo</dt>
                <dd>{formatPercent(channel.targetMarginPerc)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Tipo</dt>
                <dd>{channel.isMarketplace ? "Marketplace" : "Canal direto"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Visibilidade</dt>
                <dd>{channel.visibleForItem ? "Visível" : "Oculto"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Publicações nativas</dt>
                <dd>{channel.nativeActivePublications}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Publicações legadas</dt>
                <dd>{channel.legacyActivePublications}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Total ativas</dt>
                <dd>{channel.activePublications}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Entradas de preço</dt>
                <dd>{channel.totalPriceEntries}</dd>
              </div>
            </dl>

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                {channel.enabledForItem
                  ? "Este item participa deste canal. Voce pode configurar precos e manter a exposicao publica desligada ate publicar."
                  : "Enquanto este canal nao estiver vinculado, o item nao entra nele e seus precos ficam fora da configuracao ativa."}
              </p>

              {channel.id ? (
                <div className="space-y-3">
                  {channel.enabledForItem ? (
                    <Form
                      id={`channel-visible-form-${channel.key}`}
                      method="post"
                      className="rounded-lg border border-slate-200 px-3 py-3"
                    >
                      <input type="hidden" name="_action" value="toggle-item-channel-visible" />
                      <input type="hidden" name="itemSellingChannelId" value={channel.id} />
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-900">Visivel neste canal</div>
                          <div className="text-xs text-slate-500">
                            Controla a exposicao publica sem desfazer o vinculo comercial.
                          </div>
                        </div>
                        <Switch
                          checked={channel.visibleForItem}
                          onCheckedChange={(checked) => {
                            const input = document.getElementById(
                              `channel-visible-${channel.key}`
                            ) as HTMLInputElement | null;
                            const form = document.getElementById(
                              `channel-visible-form-${channel.key}`
                            ) as HTMLFormElement | null;
                            if (input) input.value = checked ? "true" : "false";
                            form?.requestSubmit();
                          }}
                        />
                      </div>
                      <input
                        id={`channel-visible-${channel.key}`}
                        type="hidden"
                        name="visible"
                        value={channel.visibleForItem ? "true" : "false"}
                      />
                    </Form>
                  ) : null}

                  <Form
                    id={channel.enabledForItem ? undefined : `channel-link-form-${channel.key}`}
                    method="post"
                    className="w-full"
                  >
                    <input type="hidden" name="_action" value="toggle-item-channel" />
                    <input type="hidden" name="itemSellingChannelId" value={channel.id} />
                    <input type="hidden" name="enabled" value={channel.enabledForItem ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`inline-flex h-9 w-full items-center justify-center rounded-md px-3 text-xs font-semibold transition ${
                        channel.enabledForItem
                          ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "bg-slate-900 text-white hover:bg-slate-700"
                      }`}
                    >
                      {channel.enabledForItem ? "Remover do canal" : "Vincular ao canal"}
                    </button>
                  </Form>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
                  Cadastre este canal em `/admin/canais-venda` para habilitá-lo aqui.
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Bridge legada</h2>
            <p className="text-sm text-slate-600">
              {legacyPublications.length} vínculo(s) legados ainda existem para este item, mas não dirigem mais a matriz nativa.
            </p>
          </div>
          <Link to="../precos" className="text-sm underline">
            Ver matriz de preços
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {legacyPublications.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum vínculo legado encontrado para este item.</p>
          ) : (
            legacyPublications.map((publication) => (
              <div key={publication.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <div className="font-medium text-slate-900">{publication.name}</div>
                  <div className="text-xs text-slate-500">{publication.id}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {publication.publishedChannelKeys.length === 0 ? (
                      <span className="text-[11px] text-slate-400">Sem canal com preço publicado</span>
                    ) : (
                      publication.publishedChannelKeys.map((channelKey) => (
                        <span key={channelKey} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-600">
                          {channelKey}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span className={`rounded-full px-2 py-1 ${publication.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {publication.active ? "Ativo" : "Inativo"}
                  </span>
                  <span className={`rounded-full px-2 py-1 ${publication.visible ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {publication.visible ? "Visível" : "Oculto"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
