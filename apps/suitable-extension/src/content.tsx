import {
  invoiceFromButton,
  isProducts,
  supplierBar,
  collectProducts,
  type PurchaseNote,
} from "./stock-parser";
import { FloatingStockReview } from "./floating-stock-review";
import React, { useState, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CHANNELS } from "@/domain/kds/constants";
import {
  Check as CheckIcon,
  X,
  AlertTriangle,
  Loader2,
  PackagePlus,
  CircleCheck,
  CircleAlert,
  ExternalLink,
  PanelTopOpen,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import css from "isolated-review-style";
import interFonts from "isolated-fonts";

if (!(globalThis as any).suitableInterLoaded) {
  (globalThis as any).suitableInterLoaded = true;
  for (const font of interFonts) {
    const face = new FontFace(
      "SuitableInter",
      Uint8Array.from(atob(font.source.split(",")[1]), (character) =>
        character.charCodeAt(0)
      ),
      {
        weight: String(font.weight),
        display: "swap",
      }
    );
    document.fonts.add(face);
    face.load().catch(() => {});
  }
}

type Item = {
  name: string;
  quantity: number;
  size: string | null;
  flavors: string[];
  notes: string[];
};
type Order = {
  commandNumber: number;
  date: string;
  customerName: string;
  customerPhone: string;
  orderAmount: number;
  takeAway: boolean;
  orderItems: Item[];
  deliveryNeighborhood: string;
  deliveryCity: string;
  deliveryFee: number | null;
};
declare const SuitableKds: {
  extractModal(dialog: Element): Order | null;
  validateItems(items: Item[]): Item[];
};
declare const chrome: {
  runtime: {
    onMessage?: {
      addListener(
        listener: (message: {
          type?: string;
          kdsEnabled?: boolean;
          stockEnabled?: boolean;
          stockCheckTotal?: boolean;
        }) => void
      ): void;
    };
    sendMessage(message: unknown): Promise<{
      ok: boolean;
      status?: string;
      reopenedDay?: boolean;
      error?: string;
      zones?: Zone[];
      check?: Check;
      purchaseSummary?: {
        last: string | null;
        weekly: number;
        monthly: number;
      } | null;
    }>;
  };
};
const sizes = ["F", "M", "P", "I", "FT"];
const sizeNames: Record<string, string> = {
  F: "Família",
  M: "Média",
  P: "Pequena",
  I: "Individual",
  FT: "Fatia",
};
const money = (amount: number) =>
  amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const parseMoney = (value: string) =>
  Number(
    value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value
  );
const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
const roots = new WeakMap<Element, Root>();
type Check = {
  exists: boolean;
  status: string | null;
  available: Record<string, number> | null;
  shortages: string[];
  dayStatus: string;
  canSend: boolean;
};
type Zone = { id: string; name: string; city?: string | null };
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

type CheckState = "ok" | "error" | "warning" | "loading";
function CheckColumn({
  title,
  state,
  detail,
  action,
  children,
}: {
  title: string;
  state: CheckState;
  detail: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const Icon = {
    ok: CheckIcon,
    error: X,
    warning: AlertTriangle,
    loading: Loader2,
  }[state];
  const label = {
    ok: "OK",
    error: "Erro",
    warning: "Alerta",
    loading: "Consultando",
  }[state];
  return (
    <div
      className="check-column"
      data-state={state}
      role={state === "error" ? "alert" : "status"}
    >
      <div className="check-heading">
        <div className="check-icon-row">
          <span
            className="check-icon"
            role="img"
            aria-label={`${label}: ${detail}`}
            title={detail}
          >
            <Icon size={18} aria-hidden="true" />
          </span>
        </div>
        <h3 className="check-title">{title}</h3>
        {action}
      </div>
      <div className="check-description">
        {children || <p className="check-detail">{detail}</p>}
      </div>
    </div>
  );
}

function Review({
  order,
  close,
  portalContainer,
  onConfirmed,
}: {
  order: Order;
  close: () => void;
  portalContainer: HTMLElement;
  onConfirmed: (exists: boolean) => void;
}) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [zoneError, setZoneError] = useState("");
  const [loadingZones, setLoadingZones] = useState(!order.takeAway);
  const [zoneAttempt, setZoneAttempt] = useState(0);
  const [fee, setFee] = useState(
    order.deliveryFee == null ? "" : money(order.deliveryFee)
  );
  useEffect(() => {
    if (order.takeAway) return;
    let active = true;
    setLoadingZones(true);
    setZoneError("");
    chrome.runtime
      .sendMessage({ type: "suitable:zones" })
      .then((result) => {
        if (!active) return;
        if (!result?.ok || !Array.isArray(result.zones))
          throw new Error(
            result?.error || "Não foi possível carregar os bairros do KDS."
          );
        const loaded = result.zones;
        setZones(loaded);
        const matches = loaded.filter(
          (zone) =>
            normalize(zone.name) === normalize(order.deliveryNeighborhood)
        );
        const cityMatches = matches.filter(
          (zone) => normalize(zone.city || "") === normalize(order.deliveryCity)
        );
        const matched =
          matches.length === 1
            ? matches[0]
            : cityMatches.length === 1
            ? cityMatches[0]
            : null;
        setZoneId(matched?.id || "");
      })
      .catch((cause) => {
        if (active) setZoneError(cause.message);
      })
      .finally(() => {
        if (active) setLoadingZones(false);
      });
    return () => {
      active = false;
    };
  }, [zoneAttempt, order]);
  const [items, setItems] = useState(
    order.orderItems.map((item) => ({ ...item }))
  );
  const [command, setCommand] = useState(String(order.commandNumber));
  const [date, setDate] = useState(order.date);
  const [name, setName] = useState(order.customerName);
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [phone, setPhone] = useState(order.customerPhone);
  const [purchaseSummary, setPurchaseSummary] = useState<{
    last: string | null;
    weekly: number;
    monthly: number;
  } | null>(null);
  const [crmState, setCrmState] = useState("loading");
  useEffect(() => {
    let active = true;
    setPurchaseSummary(null);
    setCrmState(phone.replace(/\D/g, "").length < 8 ? "empty" : "loading");
    if (phone.replace(/\D/g, "").length < 8) return;
    const timer = setTimeout(() => {
      chrome.runtime
        .sendMessage({ type: "suitable:customer", phone })
        .then((result) => {
          if (!active) return;
          if (!result?.ok) throw new Error(result?.error);
          setPurchaseSummary(result.purchaseSummary ?? null);
          setCrmState("ready");
        })
        .catch(() => {
          if (active) setCrmState("error");
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phone]);
  const [amount, setAmount] = useState(money(order.orderAmount));
  const [channel, setChannel] = useState<string>("CARDAPIO");
  const [pending, setPending] = useState(false);
  const [openingDay, setOpeningDay] = useState(false);
  const [openDayError, setOpenDayError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);
  async function openDay() {
    if (openingDay || checking || !check || checkError) return;
    setOpeningDay(true);
    setOpenDayError("");
    try {
      const result = await chrome.runtime.sendMessage({
        type: "suitable:open-day",
        order: { date },
      });
      if (!result?.ok)
        throw new Error(result?.error || "Sem resposta da extensão.");
      setChecking(true);
      setCheckAttempt((value) => value + 1);
    } catch (cause) {
      setOpenDayError(
        cause instanceof Error ? cause.message : "Não foi possível abrir o dia."
      );
    } finally {
      setOpeningDay(false);
    }
  }
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState(
    !items.length
      ? "Não foi possível ler os itens. Reabra os detalhes após carregar o resumo."
      : items.some((item) => /\bpizzas?\b/i.test(item.name) && !item.size)
      ? "Selecione o tamanho das pizzas não reconhecidas antes de enviar."
      : ""
  );
  useEffect(() => {
    let active = true;
    setCheck(null);
    setChecking(true);
    setCheckError("");
    const timer = setTimeout(() => {
      chrome.runtime
        .sendMessage({
          type: "suitable:check",
          order: { date, commandNumber: Number(command), orderItems: items },
        })
        .then((result) => {
          if (!active) return;
          if (!result?.ok || !result.check)
            throw new Error(
              result?.error || "Não foi possível consultar pedido e estoque."
            );
          setCheck(result.check);
          if (date === order.date && Number(command) === order.commandNumber)
            onConfirmed(result.check.exists);
        })
        .catch((cause) => {
          if (active) setCheckError(cause.message);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [date, command, items, checkAttempt]);
  const update = (index: number, change: Partial<Item>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...change } : item))
    );
  const counts = Object.fromEntries(
    sizes.map((size) => [
      size,
      items
        .filter((item) => item.size === size)
        .reduce((total, item) => total + item.quantity, 0),
    ])
  );
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!check?.canSend || checking || openingDay) return;
    setPending(true);
    setError(false);
    setMessage("Enviando pedido…");
    try {
      const orderAmount = parseMoney(amount);
      if (!amount.trim() || !Number.isFinite(orderAmount) || orderAmount < 0)
        throw new Error("Confira o total do pedido.");
      const orderItems = SuitableKds.validateItems(
        items.map((item) => ({
          ...item,
          flavors: lines(item.flavors.join("\n")),
          notes: lines(item.notes.join("\n")),
        }))
      );
      if (
        !order.takeAway &&
        (!fee.trim() ||
          !Number.isFinite(parseMoney(fee)) ||
          parseMoney(fee) < 0 ||
          !zoneId)
      )
        throw new Error(
          "Confira a taxa e selecione um bairro cadastrado no KDS."
        );
      const result = await chrome.runtime.sendMessage({
        type: "suitable:create",
        order: {
          ...order,
          commandNumber: Number(command),
          date,
          customerName: name,
          customerPhone: phone,
          orderAmount,
          channel,
          orderItems,
          updateExisting: check?.exists === true,
          ...(!order.takeAway
            ? { deliveryZoneId: zoneId, deliveryFee: parseMoney(fee) }
            : {}),
        },
      });
      if (!result?.ok)
        throw new Error(result?.error || "Sem resposta da extensão.");
      if (date === order.date && Number(command) === order.commandNumber)
        onConfirmed(true);
      setDone(true);
      setCheck((current) =>
        current
          ? {
              ...current,
              exists: true,
              status: result.status || current.status,
              canSend: false,
            }
          : current
      );
      setMessage(
        check?.exists
          ? "Pedido atualizado no KDS. Status de produção preservado."
          : result.status === "pendente"
          ? "Pedido criado como pendente. Complete os dados no Atendimento."
          : `Pedido enviado à cozinha com pizzas, tamanhos e sabores.${
              result.reopenedDay ? " Dia reaberto automaticamente." : ""
            }`
      );
    } catch (cause) {
      setDetailsOpen(true);
      setCheckAttempt((value) => value + 1);
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar o pedido."
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="extension review">
      <form
        className="panel"
        onSubmit={send}
        onInvalidCapture={(event) => {
          setDetailsOpen(true);
          const target = event.target as HTMLElement;
          requestAnimationFrame(() => target.focus());
        }}
      >
        <header className="heading">
          <div className="kds-review-row">
            <h2 className="command-bubble" title={`Comanda ${command}`}>
              <span className="sr-only">Revisar pedido · </span>
              {command || "—"}
            </h2>
            <span className="order-total font-mono text-sm font-semibold text-slate-900">
              R${" "}
              {Number.isFinite(parseMoney(amount))
                ? money(parseMoney(amount))
                : "—"}
            </span>
            <div className="sizes" aria-label="Resumo de tamanhos">
              {sizes.map((size) => (
                <span
                  key={size}
                  className={`bubble ${counts[size] > 0 ? "active" : ""}`}
                  aria-label={`${sizeNames[size]}: ${counts[size]}`}
                >
                  {size}
                  {counts[size] > 0 && (
                    <strong className="font-mono">{counts[size]}</strong>
                  )}
                </span>
              ))}
            </div>
            <div className="w-[180px] max-w-full">
              <span id="channel-label" className="sr-only">
                Origem do pedido
              </span>
              <Select
                name="channel"
                value={channel}
                onValueChange={setChannel}
                disabled={pending || done}
              >
                <SelectTrigger
                  aria-labelledby="channel-label"
                  title="Origem do pedido"
                  className="h-9 text-xs"
                >
                  <SelectValue placeholder="Origem do pedido" />
                </SelectTrigger>
                <SelectContent portalContainer={portalContainer}>
                  {CHANNELS.filter((value) => value !== "Suitable").map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            {!order.takeAway && (
              <div className="delivery-neighborhood">
                <span id="delivery-label" className="sr-only">
                  Bairro de entrega no KDS
                </span>
                <Select
                  value={zoneId}
                  onValueChange={(value) => {
                    if (value) setZoneId(value);
                  }}
                  disabled={loadingZones || pending || done}
                >
                  <SelectTrigger
                    aria-labelledby="delivery-label"
                    className="h-9 text-xs"
                    title="Alterar bairro de entrega"
                  >
                    <SelectValue
                      placeholder={
                        loadingZones
                          ? order.deliveryNeighborhood || "Carregando bairros…"
                          : "Selecionar bairro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent portalContainer={portalContainer}>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                        {zone.city ? ` · ${zone.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>{" "}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={checking || pending || openingDay}
                aria-label="Atualizar comanda e estoque"
                title="Atualizar comanda e estoque"
                onClick={() => setCheckAttempt((value) => value + 1)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M20 7v5h-5M4 17v-5h5" />
                  <path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 17.9 17" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label={
                  detailsOpen ? "Ocultar detalhes" : "Mostrar detalhes"
                }
                title={detailsOpen ? "Ocultar detalhes" : "Mostrar detalhes"}
                aria-expanded={detailsOpen}
                aria-controls="order-details"
                onClick={() => setDetailsOpen((value) => !value)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  style={{
                    transform: detailsOpen ? "rotate(180deg)" : undefined,
                  }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </Button>
            </div>
          </div>
          <div className="customer-inline">
            <Input
              aria-label="Cliente"
              title="Clique para alterar o cliente"
              name="customerName"
              maxLength={200}
              required
              disabled={pending || done}
              readOnly={editingCustomer !== "name"}
              value={name}
              placeholder="Nome do cliente"
              onFocus={(e) => {
                setEditingCustomer("name");
                e.target.select();
              }}
              onBlur={() => setEditingCustomer(null)}
              onChange={(e) => setName(e.target.value)}
              className="inline-value customer-name"
            />
            <Input
              aria-label="Telefone"
              title="Clique para alterar o telefone"
              name="customerPhone"
              type="tel"
              disabled={pending || done}
              readOnly={editingCustomer !== "phone"}
              value={phone}
              placeholder="Adicionar telefone"
              onFocus={(e) => {
                setEditingCustomer("phone");
                e.target.select();
              }}
              onBlur={() => setEditingCustomer(null)}
              onChange={(e) => setPhone(e.target.value)}
              className="inline-value customer-phone font-mono"
            />
            <div
              className="customer-kpis"
              aria-label="Histórico de compras do cliente"
              aria-busy={crmState === "loading"}
              title="Média de compras desde a primeira compra registrada no CRM. Pedidos cancelados ou pendentes não entram na média."
            >
              {[
                [
                  "Última compra",
                  purchaseSummary?.last
                    ? new Date(purchaseSummary.last).toLocaleDateString(
                        "pt-BR",
                        { timeZone: "America/Sao_Paulo" }
                      )
                    : null,
                ],
                [
                  "Média semanal",
                  purchaseSummary
                    ? `${purchaseSummary.weekly.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })} compras`
                    : null,
                ],
                [
                  "Média mensal",
                  purchaseSummary
                    ? `${purchaseSummary.monthly.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })} compras`
                    : null,
                ],
              ].map(([label, value]) => (
                <div className="customer-kpi" key={label}>
                  <span>{label}</span>
                  <strong>
                    {crmState === "loading"
                      ? "…"
                      : crmState === "error"
                      ? "Indisponível"
                      : value || "—"}
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <div
            className="order-checks"
            aria-label="Verificações do pedido"
            aria-busy={checking}
          >
            <CheckColumn
              title="Comanda existente"
              state={
                checking ? "loading" : checkError || !check ? "error" : "ok"
              }
              detail={
                checking
                  ? "Consultando…"
                  : checkError || !check
                  ? "Consulta indisponível"
                  : check.exists
                  ? `Esta comanda será atualizada no servidor (${
                      check.status || "confira no Atendimento"
                    }).`
                  : "Comanda ainda não adicionada."
              }
            />
            <CheckColumn
              title="Estoque massa"
              state={
                checking
                  ? "loading"
                  : checkError || !check
                  ? "error"
                  : check.shortages.length
                  ? "error"
                  : !check.available
                  ? "warning"
                  : "ok"
              }
              detail={
                checking
                  ? "Consultando…"
                  : checkError || !check
                  ? "Consulta indisponível"
                  : !check.available
                  ? "Estoque de massas não cadastrado; saldo não verificado."
                  : check.shortages.length
                  ? `Massa insuficiente: ${check.shortages.join(", ")}.`
                  : "Saldo disponível por tamanho."
              }
            >
              {!checking && !checkError && check?.available && (
                <>
                  {check.shortages.length > 0 && (
                    <p className="check-detail">
                      Massa insuficiente: {check.shortages.join(", ")}. Avise o
                      cliente para avaliar outro tamanho ou cancelar o pedido. O
                      envio continua disponível.
                    </p>
                  )}
                  <div className="dough-numbers">
                    {sizes.map((size) => (
                      <div
                        className="dough-number"
                        key={size}
                        data-shortage={check.shortages.includes(size)}
                        title={`${sizeNames[size]}: ${
                          check.available![size]
                        } disponíveis / ${counts[size]} necessárias`}
                        aria-label={`${sizeNames[size]}: ${
                          check.available![size]
                        } disponíveis / ${counts[size]} necessárias`}
                      >
                        <span>{size}</span>
                        <strong>{check.available![size]}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CheckColumn>
            <CheckColumn
              title="Abertura dia"
              state={
                checking || openingDay
                  ? "loading"
                  : checkError || !check
                  ? "error"
                  : ["OPENED", "REOPENED"].includes(check.dayStatus)
                  ? "ok"
                  : "error"
              }
              detail={
                openingDay
                  ? "Abrindo dia…"
                  : checking
                  ? "Consultando…"
                  : checkError || !check
                  ? "Consulta indisponível"
                  : check.dayStatus === "OPENED"
                  ? "Dia aberto."
                  : check.dayStatus === "REOPENED"
                  ? "Dia reaberto."
                  : check.dayStatus === "CLOSED"
                  ? "Dia fechado."
                  : "Dia ainda não aberto."
              }
              action={
                check &&
                !checkError &&
                !["OPENED", "REOPENED"].includes(check.dayStatus) && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="open-day-action"
                    disabled={openingDay || checking || pending || done}
                    onClick={openDay}
                  >
                    {openingDay ? "Abrindo…" : "Abrir o dia"}
                  </Button>
                )
              }
            />
          </div>
          {openDayError && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {openDayError}
            </p>
          )}
          {!checking && checkError && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {checkError}
            </p>
          )}
        </header>
        <div className="scroll" id="order-details" hidden={!detailsOpen}>
          <fieldset
            disabled={pending || done || openingDay}
            className="review-details min-w-0"
          >
            <section aria-label="Dados do pedido">
              <h3 className="section-title">Dados do pedido</h3>
              <div className="fields">
                <label className="field">
                  Comanda
                  <Input
                    name="commandNumber"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="h-9 font-mono"
                  />
                </label>
                <label className="field">
                  Data
                  <Input
                    name="date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </label>
                <label className="field total">
                  Total do pedido (R$)
                  <Input
                    name="orderAmount"
                    inputMode="decimal"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => {
                      if (amount.trim() && Number.isFinite(parseMoney(amount)))
                        setAmount(money(parseMoney(amount)));
                    }}
                    className="h-9 font-mono"
                  />
                </label>
              </div>
              {!order.takeAway && (
                <section className="delivery-section" aria-label="Entrega">
                  <h3 className="section-title">Entrega</h3>
                  <div className="delivery">
                    <div className="field">
                      <span>Bairro no KDS</span>
                      <span className="text-sm text-slate-900">
                        {zones.find((zone) => zone.id === zoneId)?.name ||
                          "Selecionar bairro no cabeçalho"}
                      </span>
                      <span className="text-xs text-slate-500">
                        Suitable:{" "}
                        {order.deliveryNeighborhood || "bairro não informado"}
                        {order.deliveryCity ? ` · ${order.deliveryCity}` : ""}
                      </span>
                      {zoneError && (
                        <div role="alert" className="text-xs text-red-700">
                          {zoneError}{" "}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setZoneAttempt((value) => value + 1)}
                          >
                            Tentar novamente
                          </Button>
                        </div>
                      )}
                      {!loadingZones && !zoneError && !zoneId && (
                        <span className="text-xs text-amber-700">
                          Selecione o bairro correspondente. Nenhum cadastro
                          será criado automaticamente.
                        </span>
                      )}
                    </div>
                    <label className="field">
                      Taxa de entrega (R$)
                      <Input
                        name="deliveryFee"
                        inputMode="decimal"
                        required
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        onBlur={() => {
                          if (fee.trim() && Number.isFinite(parseMoney(fee)))
                            setFee(money(parseMoney(fee)));
                        }}
                        className="h-9 font-mono"
                      />
                    </label>
                    <p className="delivery-hint text-xs text-slate-500">
                      O total do pedido já inclui a taxa de entrega.
                    </p>
                  </div>
                </section>
              )}
            </section>
            <section className="items-section" aria-label="Pizzas e itens">
              <h3 className="section-title items-title">
                Pizzas e itens{" "}
                <span className="section-count">{items.length}</span>
              </h3>
              {items.map((item, index) => (
                <article className="item" key={index}>
                  <div className="item-row">
                    <span className="item-label">Item {index + 1}</span>
                    <label className="field">
                      Qtd.
                      <Input
                        className="quantity h-9 text-center font-mono"
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        required
                        value={item.quantity || ""}
                        onChange={(e) =>
                          update(index, { quantity: Number(e.target.value) })
                        }
                      />
                    </label>
                    <div className="field item-size">
                      <span>Tamanho</span>
                      <div
                        className="sizes"
                        role="group"
                        aria-label={`Tamanho do item ${index + 1}`}
                      >
                        {sizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            className={`bubble ${
                              item.size === size ? "active" : ""
                            }`}
                            aria-label={sizeNames[size]}
                            aria-pressed={item.size === size}
                            title={sizeNames[size]}
                            onClick={() => update(index, { size })}
                          >
                            {size}
                          </button>
                        ))}
                        {!/\bpizzas?\b/i.test(item.name) && (
                          <button
                            type="button"
                            className="rounded-md border px-2 text-xs"
                            aria-pressed={!item.size}
                            onClick={() => update(index, { size: null })}
                          >
                            Outro
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <label className="field mt-3">
                    Sabores
                    <Textarea
                      className="flavors min-h-0 resize-y text-sm"
                      rows={Math.max(1, Math.min(3, item.flavors.length))}
                      value={item.flavors.join("\n")}
                      onChange={(e) =>
                        update(index, { flavors: e.target.value.split("\n") })
                      }
                    />
                  </label>
                  <details open={item.notes.length > 0 || undefined}>
                    <summary>
                      Observações / adicionais
                      {item.notes.length > 0 ? ` · ${item.notes.length}` : ""}
                    </summary>
                    <label className="field mt-2">
                      <span className="sr-only">
                        Observações do item {index + 1}
                      </span>
                      <Textarea
                        className="notes min-h-0 resize-y text-sm"
                        rows={2}
                        value={item.notes.join("\n")}
                        onChange={(e) =>
                          update(index, { notes: e.target.value.split("\n") })
                        }
                      />
                    </label>
                  </details>
                </article>
              ))}
            </section>
          </fieldset>
        </div>
        <footer className="footer">
          <p
            className={`message mb-2 text-sm ${
              error ? "text-red-700" : "text-blue-800"
            }`}
            role={error ? "alert" : "status"}
            aria-live="polite"
          >
            {message}
          </p>
          <div className="footer-row">
            <span className="text-xs text-slate-500">
              {done
                ? "Disponível no KDS"
                : "Confira os dados antes de adicionar."}
            </span>
            <div className="footer-actions flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={close}
              >
                {done ? "Fechar" : "Cancelar"}
              </Button>
              {!done && (
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    pending ||
                    openingDay ||
                    !items.length ||
                    checking ||
                    !check?.canSend
                  }
                >
                  {pending
                    ? "Enviando…"
                    : check?.exists
                    ? "Atualizar"
                    : "Enviar"}
                </Button>
              )}
            </div>
          </div>
        </footer>
      </form>
    </div>
  );
}

function attach(host: HTMLElement) {
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = css;
  const mount = document.createElement("div");
  const portalContainer = document.createElement("div");
  portalContainer.className = "extension";
  shadow.append(style, mount, portalContainer);
  const root = createRoot(mount);
  roots.set(host, root);
  host.addEventListener("click", (event) => event.stopPropagation());
  host.addEventListener("keydown", (event) => event.stopPropagation());
  return { root, portalContainer };
}
function review(
  dialog: Element,
  order: Order,
  onConfirmed: (exists: boolean) => void
) {
  const previous = dialog.querySelector("[data-amodomio-review]");
  if (previous) {
    roots.get(previous)?.unmount();
    previous.remove();
  }
  const host = document.createElement("div");
  host.dataset.amodomioReview = "true";
  // The Suitable paper is a flex column. Keep the review from shrinking
  // behind the original order content when the dialog reaches its height limit.
  host.style.cssText = "flex:0 0 auto;min-width:0;width:100%";
  const { root, portalContainer } = attach(host);
  dialog.firstElementChild!.after(host);
  flushSync(() =>
    root.render(
      <Review
        portalContainer={portalContainer}
        order={order}
        onConfirmed={onConfirmed}
        close={() => {
          root.unmount();
          host.remove();
        }}
      />
    )
  );
  host.scrollIntoView({ block: "nearest" });
}

function AddToKds({ dialog }: { dialog: Element }) {
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    let currentKey = "";
    let request = 0;
    async function checkOrder() {
      const order = SuitableKds.extractModal(dialog);
      if (!order) return;
      const key = `${order.date}:${order.commandNumber}`;
      if (key === currentKey) return;
      currentKey = key;
      const version = ++request;
      setConfirmed(false);
      setChecking(true);
      setError("");
      try {
        const result = await chrome.runtime.sendMessage({
          type: "suitable:check",
          order,
        });
        if (!active || version !== request) return;
        if (!result?.ok || !result.check)
          throw new Error(
            result?.error || "Não foi possível consultar a comanda no KDS."
          );
        setConfirmed(result.check.exists);
      } catch (cause) {
        if (active && version === request)
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível consultar a comanda no KDS."
          );
      } finally {
        if (active && version === request) setChecking(false);
      }
    }
    const observer = new MutationObserver(() => void checkOrder());
    observer.observe(dialog, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    void checkOrder();
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [dialog]);
  return (
    <div className="extension">
      <Button
        type="button"
        size="sm"
        disabled={checking}
        className={confirmed ? "bg-green-700 hover:bg-green-800" : undefined}
        onClick={() => {
          setError("");
          try {
            const order = SuitableKds.extractModal(dialog);
            if (!order) {
              throw new Error(
                "Não foi possível ler o pedido. Aguarde o resumo de valores carregar e tente novamente."
              );
            }
            review(dialog, order, setConfirmed);
          } catch (cause) {
            console.error(
              "[Suitable → Amodomio] Falha ao abrir revisão",
              cause
            );
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível abrir a revisão. Recarregue a extensão e a página do Suitable."
            );
          }
        }}
      >
        {confirmed && (
          <CheckIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
        )}
        {checking
          ? "Consultando KDS…"
          : confirmed
          ? "Comanda enviada"
          : "Adicionar ao KDS"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const BATCH_STATUS: Record<string, string> = {
  draft: "pendente",
  validated: "validado",
  imported: "já importado",
  partial: "importado em parte",
  rolled_back: "desfeito",
};
function StockEntry({
  dialog,
  note,
  portalContainer,
  checkTotal,
}: {
  dialog: Element;
  note: PurchaseNote | null;
  portalContainer: HTMLElement;
  checkTotal: () => boolean;
}) {
  const [batch, setBatch] = useState<{
    url: string;
    embedUrl?: string;
    existing?: boolean;
    status?: string;
  } | null>(null);
  const [panel, setPanel] = useState<"none" | "open" | "closed">("none");
  const created = !!batch;
  // Suitable only lets the user open "Contas" after products are linked, so
  // keep that tab closed until the entry batch exists.
  useEffect(() => {
    if (!note || created) return;
    const block = (event: Event) => {
      const button = (event.target as Element | null)?.closest?.("button");
      if (
        !button ||
        !dialog.contains(button) ||
        button.textContent?.trim() !== "Contas"
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setError("Crie o lote de entrada antes de abrir Contas.");
    };
    dialog.addEventListener("click", block, true);
    return () => dialog.removeEventListener("click", block, true);
  }, [dialog, note, created]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function request(payload: Record<string, unknown>): Promise<any> {
    const result = await chrome.runtime.sendMessage({
      type: "suitable:stock",
      payload,
    });
    if (!result?.ok)
      throw new Error(result?.error || "Não foi possível acessar o servidor");
    return result;
  }
  return (
    <div className="extension overflow-hidden rounded-lg border border-l-4 border-l-[#46a69d] bg-white text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            aria-hidden="true"
          >
            <PackagePlus className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight text-slate-900">
              Importação de estoque
            </h2>
            <p className="truncate text-xs text-slate-500">
              {note ? (
                <>
                  NF {note.invoiceNumber}
                  <span aria-hidden="true"> · </span>
                  {note.supplierName}
                </>
              ) : (
                "Nenhuma nota selecionada"
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {batch ? (
            <>
              {batch.embedUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={panel === "open"}
                  onClick={() =>
                    setPanel((value) => (value === "open" ? "closed" : "open"))
                  }
                >
                  <PanelTopOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                  {panel === "open"
                    ? "Fechar importação"
                    : "Abrir importação aqui"}
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <a href={batch.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                  Abrir no Amodomio
                </a>
              </Button>
            </>
          ) : (
            note && (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const input = await collectProducts(dialog, note, {
                      checkTotal: checkTotal(),
                    });
                    const result = await request({
                      action: "create",
                      note: input,
                    });
                    if (!result.url)
                      throw new Error("Atualize o servidor Amodomio.");
                    setBatch({
                      url: result.url,
                      embedUrl: result.embedUrl,
                      existing: result.existing === true,
                      status: result.batchStatus,
                    });
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Falha ao ler nota"
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : null}
                {busy ? "Lendo nota…" : "Criar lote de entrada"}
              </Button>
            )
          )}
        </div>
      </div>
      {(!note || error || batch) && (
        <div className="space-y-1 border-t bg-slate-50 px-4 py-2 text-xs">
          {!note && (
            <p className="flex items-center gap-2 text-slate-600">
              <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              Volte à lista de notas e clique em Lançar entrada para identificar
              o número e a data da nota.
            </p>
          )}
          {batch && (
            <p role="status" className="flex items-center gap-2 text-green-800">
              <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              {batch.existing
                ? `Lote já existia no Amodomio (${
                    BATCH_STATUS[batch.status || ""] || "em andamento"
                  }). `
                : "Lote criado no Amodomio. "}
              Vincule os produtos no Suitable; o vínculo no estoque pode ser
              feito depois ou aqui.
            </p>
          )}
          {error && (
            <p role="alert" className="flex items-center gap-2 text-red-700">
              <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      )}
      {batch?.embedUrl && panel !== "none" && (
        <FloatingStockReview
          embedUrl={batch.embedUrl}
          note={note}
          portalContainer={portalContainer}
          hidden={panel === "closed"}
          onClose={() => setPanel("closed")}
        />
      )}
    </div>
  );
}

if (!(globalThis as any).suitableKdsStarted) {
  (globalThis as any).suitableKdsStarted = true;
  let kdsEnabled = false;
  let stockEnabled = false;
  let stockCheckTotal = false;
  chrome.runtime
    .sendMessage({ type: "suitable:preferences-read" })
    .then((result) => {
      kdsEnabled = result?.ok === true && result.kdsEnabled !== false;
      stockEnabled = result?.ok === true && result.stockEnabled !== false;
      stockCheckTotal = result?.ok === true && result.stockCheckTotal === true;
      scan();
    })
    .catch(() => {});
  let selectedNote: PurchaseNote | null = null;
  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target instanceof Element ? event.target.closest("button") : null;
      if (!target || !target.closest('.MuiDialog-paper[role="dialog"]')) return;
      const note = invoiceFromButton(target);
      if (note) selectedNote = note;
    },
    true
  );
  function removeStock() {
    for (const host of document.querySelectorAll("[data-amodomio-stock]")) {
      roots.get(host as HTMLElement)?.unmount();
      roots.delete(host as HTMLElement);
      host.remove();
    }
  }
  function scan() {
    if (!stockEnabled) removeStock();
    for (const dialog of stockEnabled
      ? document.querySelectorAll('.MuiDialog-paper[role="dialog"]')
      : []) {
      const previous = dialog.querySelector<HTMLElement>(
        "[data-amodomio-stock]"
      );
      if (!isProducts(dialog)) {
        if (previous) {
          roots.get(previous)?.unmount();
          roots.delete(previous);
          previous.remove();
        }
        continue;
      }
      const key = selectedNote
        ? `${selectedNote.supplierName}:${selectedNote.invoiceNumber}`
        : "unknown";
      if (previous?.dataset.noteKey === key) continue;
      if (previous) {
        roots.get(previous)?.unmount();
        roots.delete(previous);
        previous.remove();
      }
      const host = document.createElement("div");
      host.dataset.amodomioStock = "true";
      host.dataset.noteKey = key;
      const bar = supplierBar(dialog);
      host.style.cssText = bar
        ? "flex-shrink:0;margin:8px 0"
        : "flex-shrink:0;margin:12px 24px";
      const { root, portalContainer } = attach(host);
      (bar || dialog.firstElementChild)?.after(host);
      flushSync(() =>
        root.render(
          <StockEntry
            dialog={dialog}
            note={selectedNote}
            portalContainer={portalContainer}
            checkTotal={() => stockCheckTotal}
          />
        )
      );
    }
    if (!kdsEnabled) return;
    for (const dialog of document.querySelectorAll(
      '.MuiDialog-paper[role="dialog"]'
    )) {
      if (
        dialog.querySelector("[data-amodomio-kds]") ||
        !SuitableKds.extractModal(dialog)
      )
        continue;
      const host = document.createElement("div");
      host.dataset.amodomioKds = "true";
      host.style.cssText = "flex-shrink:0;margin-right:8px";
      const { root } = attach(host);
      const header = dialog.firstElementChild!;
      (header.children[1] || header).prepend(host);
      flushSync(() => root.render(<AddToKds dialog={dialog} />));
    }
  }
  chrome.runtime.onMessage?.addListener((message) => {
    if (message.type !== "suitable:preferences") return;
    kdsEnabled = message.kdsEnabled !== false;
    stockEnabled = message.stockEnabled !== false;
    stockCheckTotal = message.stockCheckTotal === true;
    if (!stockEnabled) removeStock();
    if (!kdsEnabled) {
      for (const host of document.querySelectorAll(
        "[data-amodomio-kds], [data-amodomio-review]"
      )) {
        roots.get(host)?.unmount();
        roots.delete(host);
        host.remove();
      }
    } else scan();
  });
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      scan();
    });
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  scan();
}
