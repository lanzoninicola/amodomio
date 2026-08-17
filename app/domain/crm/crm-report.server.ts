import prisma from "~/lib/prisma/client.server";

type Period = {
  start: Date;
  end: Date;
};

export type CrmReport = Awaited<ReturnType<typeof readCrmReport>>;

const percentage = (value: number, total: number) =>
  total > 0 ? value / total : 0;

const customerIds = (rows: Array<{ customer_id: string }>) =>
  new Set(rows.map((row) => row.customer_id));

export async function readCrmReport(input: {
  currentPeriod: Period;
  previousPeriod: Period;
}) {
  const { currentPeriod, previousPeriod } = input;

  const [
    totalCustomers,
    newCustomersCurrent,
    newCustomersPrevious,
    currentEvents,
    previousEvents,
    profileCoverage,
    tagLinks,
    topCustomers,
    customersAtRisk,
  ] = await Promise.all([
    prisma.crmCustomer.count(),
    prisma.crmCustomer.count({
      where: {
        created_at: { gte: currentPeriod.start, lt: currentPeriod.end },
      },
    }),
    prisma.crmCustomer.count({
      where: {
        created_at: { gte: previousPeriod.start, lt: previousPeriod.end },
      },
    }),
    prisma.crmCustomerEvent.findMany({
      where: {
        created_at: { gte: currentPeriod.start, lt: currentPeriod.end },
      },
      select: { customer_id: true, event_type: true, created_at: true },
      orderBy: { created_at: "asc" },
    }),
    prisma.crmCustomerEvent.findMany({
      where: {
        created_at: { gte: previousPeriod.start, lt: previousPeriod.end },
      },
      select: { customer_id: true, event_type: true },
    }),
    prisma.crmCustomer.aggregate({
      _count: {
        name: true,
        email: true,
        city: true,
        neighborhood: true,
        consent_at: true,
        last_order_at: true,
      },
    }),
    prisma.crmCustomerTagLink.findMany({
      select: {
        customer_id: true,
        tag: { select: { key: true, label: true } },
      },
    }),
    prisma.crmCustomer.findMany({
      where: { total_revenue: { gt: 0 } },
      take: 8,
      orderBy: { total_revenue: "desc" },
      select: {
        id: true,
        name: true,
        phone_e164: true,
        orders_count: true,
        total_revenue: true,
        last_order_at: true,
      },
    }),
    prisma.crmCustomer.findMany({
      where: {
        total_revenue: { gt: 0 },
        OR: [
          {
            last_order_at: {
              lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            },
          },
          { last_order_at: null },
        ],
      },
      take: 8,
      orderBy: [{ total_revenue: "desc" }, { last_order_at: "asc" }],
      select: {
        id: true,
        name: true,
        phone_e164: true,
        total_revenue: true,
        last_order_at: true,
      },
    }),
  ]);

  const summarizeEvents = (
    events: Array<{ customer_id: string; event_type: string }>
  ) => {
    const sent = events.filter((event) => event.event_type === "WHATSAPP_SENT");
    const received = events.filter(
      (event) => event.event_type === "WHATSAPP_RECEIVED"
    );
    const contacted = customerIds(sent);
    const respondents = customerIds(received);
    const contactedWithResponse = [...contacted].filter((id) =>
      respondents.has(id)
    ).length;

    return {
      activeCustomers: customerIds(events).size,
      messagesSent: sent.length,
      messagesReceived: received.length,
      contactedCustomers: contacted.size,
      respondents: contactedWithResponse,
      responseCoverage: percentage(contactedWithResponse, contacted.size),
    };
  };

  const current = summarizeEvents(currentEvents);
  const previous = summarizeEvents(previousEvents);
  const taggedCustomers = new Set(tagLinks.map((link) => link.customer_id))
    .size;
  const tagCounts = new Map<
    string,
    { key: string; label: string; count: number }
  >();

  for (const link of tagLinks) {
    const item = tagCounts.get(link.tag.key) ?? {
      key: link.tag.key,
      label: link.tag.label || link.tag.key,
      count: 0,
    };
    item.count += 1;
    tagCounts.set(link.tag.key, item);
  }

  const days = new Map<
    string,
    { date: string; sent: number; received: number }
  >();
  for (const event of currentEvents) {
    if (!["WHATSAPP_SENT", "WHATSAPP_RECEIVED"].includes(event.event_type))
      continue;
    const date = event.created_at.toISOString().slice(0, 10);
    const item = days.get(date) ?? { date, sent: 0, received: 0 };
    if (event.event_type === "WHATSAPP_SENT") item.sent += 1;
    if (event.event_type === "WHATSAPP_RECEIVED") item.received += 1;
    days.set(date, item);
  }

  return {
    summary: {
      totalCustomers,
      newCustomersCurrent,
      newCustomersPrevious,
      ...current,
      previous,
    },
    quality: {
      name: percentage(profileCoverage._count.name, totalCustomers),
      email: percentage(profileCoverage._count.email, totalCustomers),
      city: percentage(profileCoverage._count.city, totalCustomers),
      neighborhood: percentage(
        profileCoverage._count.neighborhood,
        totalCustomers
      ),
      consent: percentage(profileCoverage._count.consent_at, totalCustomers),
      purchaseHistory: percentage(
        profileCoverage._count.last_order_at,
        totalCustomers
      ),
      tags: percentage(taggedCustomers, totalCustomers),
    },
    tags: [...tagCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    activity: [...days.values()],
    topCustomers: topCustomers.map((customer) => ({
      ...customer,
      total_revenue: Number(customer.total_revenue),
    })),
    customersAtRisk: customersAtRisk.map((customer) => ({
      ...customer,
      total_revenue: Number(customer.total_revenue),
    })),
  };
}
