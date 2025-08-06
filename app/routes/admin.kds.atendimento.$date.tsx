import { defer, redirect } from "@remix-run/node";
import { Await, useLoaderData, Form } from "@remix-run/react";
import { Suspense, useState } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { useHotkeys } from "react-hotkeys-hook";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Trash, Pencil } from "lucide-react";

type SizeCounts = { F: number; M: number; P: number; I: number };

function defaultSizeCounts(): SizeCounts {
  return { F: 0, M: 0, P: 0, I: 0 };
}

// Loader
export async function loader({ params }: { params: { date: string } }) {
  const currentDate = new Date(params.date);
  const dateInt = Number(
    `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, "0")}${String(
      currentDate.getDate()
    ).padStart(2, "0")}`
  );

  const ordersPromise = prismaClient.kdsOrder.findMany({
    where: { dateInt },
    orderBy: { createdAt: "asc" },
  });

  return defer({
    orders: ordersPromise,
    currentDate: currentDate.toISOString().split("T")[0],
  });
}

// Action
export async function action({ request, params }: { request: Request; params: { date: string } }) {
  const formData = await request.formData();
  const _action = formData.get("_action");

  // Delete
  if (_action === "delete") {
    const id = formData.get("id") as string;
    if (id) {
      await prismaClient.kdsOrder.delete({ where: { id } });
    }
    return redirect(`/admin/kds/atendimento/${params.date}`);
  }

  // Create / Update
  const id = formData.get("id") as string | null;
  const hasMoto = formData.get("hasMoto") === "true";
  const channel = (formData.get("channel") as string) || "";
  const status = (formData.get("status") as string) || "pendente";

  const sizeCounts: SizeCounts = JSON.parse(formData.get("size") as string);

  const currentDate = new Date(params.date);
  const dateInt = Number(
    `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, "0")}${String(
      currentDate.getDate()
    ).padStart(2, "0")}`
  );

  if (id) {
    await prismaClient.kdsOrder.update({
      where: { id },
      data: {
        size: JSON.stringify(sizeCounts),
        hasMoto,
        channel,
        status,
      },
    });
    return redirect(`/admin/kds/atendimento/${params.date}`);
  }

  await prismaClient.kdsOrder.create({
    data: {
      date: currentDate,
      dateInt,
      commandNumber: 0,
      product: "PIZZA",
      size: JSON.stringify(sizeCounts),
      hasMoto,
      motoValue: 0,
      channel,
      status,
    },
  });

  return redirect(`/admin/kds/atendimento/${params.date}`);
}

// SizeSelector
function SizeSelector({
  counts,
  onChange,
}: {
  counts: SizeCounts;
  onChange: (newCounts: SizeCounts) => void;
}) {
  function increment(size: keyof SizeCounts) {
    onChange({ ...counts, [size]: counts[size] + 1 });
  }

  function reset() {
    onChange(defaultSizeCounts());
  }

  return (
    <div className="flex items-center gap-2">
      {(["F", "M", "P", "I"] as (keyof SizeCounts)[]).map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => increment(size)}
          className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${counts[size] > 0 ? "bg-primary text-white" : "bg-white"
            }`}
        >
          {size}
          {counts[size] > 0 && <span className="ml-1">{counts[size]}</span>}
        </button>
      ))}
      <Badge variant="secondary" className="ml-1 cursor-pointer" onClick={reset}>
        Zerar
      </Badge>
    </div>
  );
}

// Página principal
export default function KdsAtendimentoPlanilha() {
  const data = useLoaderData<typeof loader>();
  const [rows, setRows] = useState(50);

  useHotkeys("enter", (e) => {
    e.preventDefault();
    const form = e.target.closest("form");
    if (form) form.requestSubmit();
  });

  const canais = ["WHTAS / PRESENCIAL / TELE", "MOGO", "AIQFOME", "IFOOD"];
  const statusOptions = ["pendente", "em preparo", "finalizado"];

  return (
    <Suspense fallback={<div>Carregando pedidos...</div>}>
      <Await resolve={data.orders}>
        {(orders) => {
          const safeOrders = Array.isArray(orders) ? orders : [];
          const displayRows = [...safeOrders, ...Array(Math.max(0, rows - safeOrders.length)).fill(null)];

          return (
            <div className="space-y-2">
              {/* Cabeçalho fixo */}
              <div className="grid grid-cols-7 gap-2 border-b font-semibold text-sm sticky top-0 bg-white z-10">
                <div className="text-center">#</div>
                <div className="text-center">Tamanho</div>
                <div className="text-center">Moto</div>
                <div className="text-center">Canal</div>
                <div className="text-center">Status</div>
                <div className="text-center">Salvar</div>
                <div className="text-center">Cancelar</div>
              </div>

              {/* Linhas */}
              <ul className="divide-y divide-gray-300">
                {displayRows.map((order, index) => {
                  let initialCounts: SizeCounts = defaultSizeCounts();
                  if (order?.size) {
                    try {
                      const parsed = JSON.parse(order.size);
                      initialCounts = { ...defaultSizeCounts(), ...parsed };
                    } catch {
                      initialCounts = defaultSizeCounts();
                    }
                  }

                  const [counts, setCounts] = useState<SizeCounts>(initialCounts);
                  const [editingMoto, setEditingMoto] = useState(false);
                  const [editingCanal, setEditingCanal] = useState(false);
                  const [editingStatus, setEditingStatus] = useState(false);

                  const currentMoto = order?.hasMoto ? "Sim" : "Não";
                  const currentCanal = order?.channel || "—";
                  const currentStatus = order?.status || "pendente";

                  return (
                    <li key={index}>
                      <Form method="post" className="grid grid-cols-7 gap-2 items-center py-2">
                        {/* Número da linha */}
                        <div className="flex justify-center">
                          <div className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                        </div>

                        {order?.id && <input type="hidden" name="id" value={order.id} />}
                        <input type="hidden" name="size" value={JSON.stringify(counts)} />

                        {/* Seletor de tamanho */}
                        <div>
                          <SizeSelector counts={counts} onChange={setCounts} />
                        </div>

                        {/* Moto */}
                        <div className="flex items-center justify-center gap-2">
                          {editingMoto ? (
                            <Select name="hasMoto" defaultValue={order?.hasMoto ? "true" : "false"}>
                              <SelectTrigger className="w-20 text-xs">
                                <SelectValue placeholder="Moto" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Sim</SelectItem>
                                <SelectItem value="false">Não</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {currentMoto}
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingMoto(!editingMoto)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Canal */}
                        <div className="flex items-center justify-center gap-2">
                          {editingCanal ? (
                            <Select name="channel" defaultValue={order?.channel ?? ""}>
                              <SelectTrigger className="w-36 text-xs">
                                <SelectValue placeholder="Canal" />
                              </SelectTrigger>
                              <SelectContent>
                                {canais.map((canal) => (
                                  <SelectItem key={canal} value={canal}>
                                    {canal}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {currentCanal}
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingCanal(!editingCanal)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-center gap-2">
                          {editingStatus ? (
                            <Select name="status" defaultValue={currentStatus}>
                              <SelectTrigger className="w-28 text-xs">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {currentStatus}
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingStatus(!editingStatus)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Botão Salvar */}
                        <div className="flex justify-center">
                          <Button type="submit" variant={"outline"}>
                            <Save className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Botão Cancelar/Excluir */}
                        <div className="flex justify-center">
                          {order?.id && (
                            <Form method="post">
                              <input type="hidden" name="id" value={order.id} />
                              <Button type="submit" name="_action" value="delete" variant={"destructive"} >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </Form>
                          )}
                        </div>
                      </Form>
                    </li>
                  );
                })}
              </ul>

              {/* Botão para adicionar mais 50 linhas */}
              {displayRows.length >= 50 && (
                <div className="flex justify-center mt-4">
                  <Button onClick={() => setRows(rows + 50)}>Adicionar 50 linhas</Button>
                </div>
              )}
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}
