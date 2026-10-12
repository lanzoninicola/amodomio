import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  rows: vi.fn(),
  total: vi.fn(),
  updateDetail: vi.fn(),
  zone: vi.fn(),
  stock: vi.fn(),
  findDetail: vi.fn(),
  findHeader: vi.fn(),
  updateHeader: vi.fn(),
  header: vi.fn(),
  maxes: vi.fn(),
  recalc: vi.fn(),
  bearer: vi.fn(),
  list: vi.fn(),
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: {
    kdsDailyOrder: { findUnique: mocks.findHeader, update: mocks.updateHeader },
    kdsDailyOrderDetail: {
      findFirst: mocks.findDetail,
      create: mocks.create,
      findMany: mocks.rows,
      aggregate: mocks.total,
      update: mocks.updateDetail,
    },
    deliveryZone: { findUnique: mocks.zone },
    $transaction: mocks.transaction,
    $queryRaw: mocks.queryRaw,
  },
}));
vi.mock("~/domain/kds/server", () => ({
  ensureHeader: mocks.header,
  getMaxes: mocks.maxes,
  recalcHeaderTotal: mocks.recalc,
  listOrdersForApiByDate: mocks.list,
}));
vi.mock("~/domain/auth/user-session.server", () => ({
  getAuthenticatedBearerSession: mocks.bearer,
}));
vi.mock("~/domain/rest-api/rest-api.entity.server", () => ({
  restApi: {
    rateLimitCheck: () => ({ success: true }),
    authorize: () => ({ status: 401 }),
  },
}));
vi.mock("~/domain/kds/dough-stock.server", () => ({
  getDoughStock: mocks.stock,
}));
import prisma from "~/lib/prisma/client.server";
import { action, loader } from "./api.kds.orders";
const items = [
  {
    name: "Pizzas INDIVIDUAL",
    quantity: 1,
    size: "I",
    flavors: ["1x A more mio"],
    notes: [],
  },
  {
    name: "Pizzas MÉDIO",
    quantity: 1,
    size: "M",
    flavors: ["1x A more mio"],
    notes: [],
  },
  {
    name: "Pizzas FAMÍLIA",
    quantity: 1,
    size: "F",
    flavors: ["1x Boscaiola", "1x Calabresa", "1x Calabresa Acebolada"],
    notes: ["Sem cebola"],
  },
];
function create(body: unknown) {
  return action({
    request: new Request("https://kds.test/api/kds/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params: {},
    context: {},
  });
}
const body = {
  date: "2026-10-11",
  commandNumber: 1,
  customerName: "Nicola Lanzoni",
  customerPhone: "46991052049",
  orderAmount: 359.7,
  channel: "Suitable",
  takeAway: true,
  orderItems: items,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.bearer.mockResolvedValue({ user: { id: "operator" } });
  mocks.header.mockResolvedValue({ id: "header" });
  mocks.findHeader.mockResolvedValue({
    id: "header",
    operationStatus: "OPENED",
  });
  mocks.transaction.mockImplementation((callback) => callback(prisma));
  mocks.rows.mockResolvedValue([]);
  mocks.total.mockResolvedValue({ _sum: { orderAmount: 359.7 } });
  mocks.stock.mockResolvedValue(null);
  mocks.zone.mockResolvedValue({ id: "zone" });
  mocks.updateDetail.mockImplementation(async ({ where, data }) => ({
    ...data,
    id: where.id,
  }));
  mocks.maxes.mockResolvedValue({ maxSort: 0 });
  mocks.create.mockImplementation(async ({ data }) => ({
    ...data,
    id: "created",
  }));
});
it("stores pizza group snapshots and counts pizzas rather than flavors, ready for the kitchen", async () => {
  const response = await create({
    ...body,
    sizes: { F: 99 },
    status: "finalizado",
  });
  expect(response.status).toBe(200);
  const data = mocks.create.mock.calls[0][0].data;
  expect(data.orderItems).toEqual(items);
  expect(JSON.parse(data.size)).toEqual({ F: 1, M: 1, P: 0, I: 1, FT: 0 });
  expect(data.status).toBe("novoPedido");
  expect(data.novoPedidoAt).toBeInstanceOf(Date);
  expect(data.customerName).toBe(body.customerName);
  expect(data.customerPhone).toBe(body.customerPhone);
  expect(data.channel).toBe("Suitable");
  expect((await response.json()).status).toBe("novoPedido");
});
it("returns stored items, name and phone in the API consumed by Windows/mobile", async () => {
  await create(body);
  const stored = mocks.create.mock.calls[0][0].data;
  mocks.list.mockResolvedValue([
    { ...stored, id: "created", DeliveryZone: null },
  ]);
  const response = await loader({
    request: new Request("https://kds.test/api/kds/orders?date=2026-10-11"),
    params: {},
    context: {},
  });
  const result = await response.json();
  expect(result.orders[0]).toMatchObject({
    orderItems: items,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    sizes: { F: 1, M: 1, I: 1 },
  });
});
it.each(
  [
    [],
    [{ ...items[0], quantity: 1.5 }],
    [{ ...items[0], quantity: -1 }],
    [{ ...items[0], size: null }],
    [{ ...items[0], size: "GRANDE" }],
    [{ ...items[0], flavors: [null] }],
    [{ ...items[0], notes: ["x".repeat(1001)] }],
  ].map((orderItems) => [orderItems])
)(
  "rejects invalid imported items before any database write: %s",
  async (orderItems) => {
    expect((await create({ ...body, orderItems })).status).toBe(400);
    expect(mocks.header).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  }
);
it("preserves the existing API contract for commands without imported items", async () => {
  const response = await create({
    date: body.date,
    commandNumber: 2,
    orderAmount: 50,
    sizes: { M: 2 },
  });
  expect(response.status).toBe(200);
  expect(mocks.create.mock.calls[0][0].data.orderItems).toBeUndefined();
  expect(mocks.create.mock.calls[0][0].data.status).toBe("novoPedido");
});
it("keeps beverages and add-ons without inventing pizza counts", async () => {
  const response = await create({
    ...body,
    orderItems: [
      ...items,
      {
        name: "Refrigerante",
        quantity: 2,
        size: null,
        flavors: [],
        notes: ["Sem gelo"],
      },
    ],
  });
  expect(response.status).toBe(200);
  expect(JSON.parse(mocks.create.mock.calls[0][0].data.size)).toEqual({
    F: 1,
    M: 1,
    P: 0,
    I: 1,
    FT: 0,
  });
  expect(mocks.create.mock.calls[0][0].data.orderItems).toHaveLength(4);
});
it("refuses a duplicate command without overwriting its contents", async () => {
  mocks.rows.mockResolvedValue([
    { id: "existing", commandNumber: 1, status: "novoPedido" },
  ]);
  const response = await create(body);
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe("duplicate_command_number");
  expect(mocks.create).not.toHaveBeenCalled();
});

it.each([0, -1, 1.5, 2147483648, "1", null])(
  "rejects invalid imported command %s before starting a transaction",
  async (commandNumber) => {
    expect((await create({ ...body, commandNumber })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  }
);
it.each([-1, 999999999, 1.001, "359,70", null])(
  "rejects invalid imported amount %s before writes",
  async (orderAmount) => {
    expect((await create({ ...body, orderAmount })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  }
);
it.each(["2026-02-30", "2026-13-01", "0000-01-01", "not-date"])(
  "rejects invalid calendar date %s",
  async (date) => {
    expect((await create({ ...body, date })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  }
);
it.each(["pending", "PENDING", null])(
  "does not open pending operation %s",
  async (operationStatus) => {
    mocks.findHeader.mockResolvedValue({ id: "header", operationStatus });
    const response = await create(body);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("day_not_open");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateHeader).not.toHaveBeenCalled();
    expect(mocks.header).not.toHaveBeenCalled();
  }
);
it("does not create a missing day", async () => {
  mocks.findHeader.mockResolvedValue(null);
  expect((await create(body)).status).toBe(409);
  expect(mocks.header).not.toHaveBeenCalled();
});
it("reopens a closed day only after successful import, using the same status as Atendimento", async () => {
  mocks.findHeader.mockResolvedValue({
    id: "header",
    operationStatus: "CLOSED",
  });
  const response = await create(body);
  expect(response.status).toBe(200);
  expect((await response.json()).reopenedDay).toBe(true);
  expect(mocks.updateHeader.mock.calls[0][0].data.operationStatus).toBe(
    "REOPENED"
  );
  expect(mocks.updateHeader.mock.calls[0][0].data.closedAt).toBeUndefined();
});
it("failed stock or duplicate validation leaves a closed day closed", async () => {
  mocks.findHeader.mockResolvedValue({
    id: "header",
    operationStatus: "CLOSED",
  });
  mocks.stock.mockResolvedValue({
    effective: { F: 0, M: 0, P: 0, I: 0, FT: 0 },
  });
  expect((await create(body)).status).toBe(409);
  expect(mocks.updateHeader).not.toHaveBeenCalled();
  mocks.rows.mockResolvedValue([
    { id: "existing", commandNumber: 1, status: "novoPedido" },
  ]);
  expect((await create(body)).status).toBe(409);
  expect(mocks.updateHeader).not.toHaveBeenCalled();
});
it("accepts an already reopened day without changing its operation status", async () => {
  mocks.findHeader.mockResolvedValue({
    id: "header",
    operationStatus: "REOPENED",
  });
  expect((await create(body)).status).toBe(200);
  expect(
    mocks.updateHeader.mock.calls[0][0].data.operationStatus
  ).toBeUndefined();
});

it("rejects insufficient dough counting all sizes already reserved for the day", async () => {
  mocks.rows.mockResolvedValue([
    {
      id: "other",
      commandNumber: 2,
      sortOrderIndex: 1000,
      size: JSON.stringify({ F: 1, M: 1 }),
    },
  ]);
  mocks.stock.mockResolvedValue({
    effective: { F: 1, M: 2, P: 0, I: 1, FT: 0 },
  });
  const response = await create(body);
  expect(response.status).toBe(409);
  expect((await response.json()).shortages).toEqual(["F"]);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.updateHeader).not.toHaveBeenCalled();
});
it("accepts exact remaining dough, counts quantities rather than flavors and recalculates total inside the transaction", async () => {
  mocks.rows.mockResolvedValue([
    {
      id: "other",
      commandNumber: 2,
      sortOrderIndex: 1000,
      size: JSON.stringify({ F: 1 }),
    },
  ]);
  mocks.stock.mockResolvedValue({
    effective: { F: 2, M: 1, P: 0, I: 1, FT: 0 },
  });
  expect((await create(body)).status).toBe(200);
  expect(mocks.create.mock.calls[0][0].data.sortOrderIndex).toBe(2000);
  expect(mocks.updateHeader).toHaveBeenCalledWith({
    where: { id: "header" },
    data: { totOrdersAmount: 359.7 },
  });
  expect(mocks.recalc).not.toHaveBeenCalled();
});
const reserved = {
  id: "reserved",
  orderId: "header",
  commandNumber: 1,
  status: "pendente",
  sortOrderIndex: 1000,
  orderAmount: 0,
  motoValue: 0,
  size: '{"F":0,"M":0,"P":0,"I":0,"FT":0}',
};
it("fills an empty reserved command preserving its identity and position", async () => {
  mocks.rows.mockResolvedValue([reserved]);
  const response = await create(body);
  expect(response.status).toBe(200);
  expect((await response.json()).id).toBe("reserved");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.updateDetail.mock.calls[0][0].data.sortOrderIndex).toBe(1000);
  expect(mocks.updateDetail.mock.calls[0][0].data.orderItems).toEqual(items);
});
it.each([
  { customerName: "Cliente" },
  { orderAmount: 20 },
  { size: '{"F":1}' },
  { orderItems: [] },
  { novoPedidoAt: new Date() },
  { deletedAt: new Date() },
  { channel: "Suitable" },
  { hasMoto: true },
  { size: "invalid-json" },
])(
  "never overwrites a populated or deleted reserved command %s",
  async (patch) => {
    mocks.rows.mockResolvedValue([{ ...reserved, ...patch }]);
    expect((await create(body)).status).toBe(409);
    expect(mocks.updateDetail).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  }
);
it("refuses ambiguous duplicate reserved rows", async () => {
  mocks.rows.mockResolvedValue([
    reserved,
    { ...reserved, id: "other-reserved" },
  ]);
  expect((await create(body)).status).toBe(409);
});
it("stores delivery zone and fee separately, without adding fee to order total", async () => {
  expect(
    (
      await create({
        ...body,
        takeAway: false,
        hasMoto: true,
        deliveryZoneId: "zone",
        motoValue: 10,
        orderAmount: 479.6,
      })
    ).status
  ).toBe(200);
  const data = mocks.create.mock.calls[0][0].data;
  expect(Number(data.orderAmount)).toBe(479.6);
  expect(Number(data.motoValue)).toBe(10);
  expect(data.hasMoto).toBe(true);
  expect(data.deliveryZoneId).toBe("zone");
});
it.each([
  { takeAway: false, motoValue: 10 },
  { takeAway: false, deliveryZoneId: "zone" },
  { takeAway: false, deliveryZoneId: "zone", motoValue: -1 },
  { takeAway: false, deliveryZoneId: "zone", motoValue: 500 },
  { motoValue: 10 },
  { deliveryZoneId: "zone" },
  { hasMoto: true },
  { takeAway: "true" },
])("validates delivery on the server %s", async (patch) => {
  expect((await create({ ...body, ...patch })).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("rejects an unknown zone without changing the operation", async () => {
  mocks.zone.mockResolvedValue(null);
  const response = await create({
    ...body,
    takeAway: false,
    deliveryZoneId: "missing",
    motoValue: 10,
  });
  expect((await response.json()).error).toBe("invalid_delivery_zone_id");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.updateHeader).not.toHaveBeenCalled();
});
it("zero value or beverage-only snapshot remains pending", async () => {
  expect((await create({ ...body, orderAmount: 0 })).status).toBe(200);
  expect(mocks.create.mock.calls[0][0].data.status).toBe("pendente");
  await create({
    ...body,
    orderItems: [
      { name: "Bebida", quantity: 1, size: null, flavors: [], notes: [] },
    ],
  });
  expect(mocks.create.mock.calls[1][0].data.status).toBe("pendente");
});
it("does not bypass import validation with a Suitable channel and omitted items", async () => {
  const { orderItems, ...withoutItems } = body;
  expect((await create(withoutItems)).status).toBe(400);
  expect(mocks.header).not.toHaveBeenCalled();
});
it("rejects unauthenticated imported requests before any write", async () => {
  mocks.bearer.mockResolvedValue({ user: null });
  expect((await create(body)).status).toBe(401);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("retains legacy auto-opening for requests without snapshots", async () => {
  mocks.findHeader.mockResolvedValue({ operationStatus: "pending" });
  expect(
    (
      await create({
        date: body.date,
        commandNumber: 2,
        orderAmount: 50,
        sizes: { M: 2 },
      })
    ).status
  ).toBe(200);
  expect(mocks.updateHeader).toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
});
