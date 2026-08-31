import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "./normalize-phone.server";
import {
  classificationTagKey,
  normalizeClassification,
  normalizeCrmCustomerName,
  parseBrCurrency,
  parseBrDate,
  parseNonNegativeInteger,
  suggestCrmCustomerImportDecision,
  type CrmCustomerCsvRow,
  type CrmCustomerImportDecision,
  type NormalizedCrmCustomerImportRow,
} from "./customer-csv-import";

const IMPORT_PROFILE_TABLE = "crm_customer_guided_import";
const IMPORT_SOURCE = "erp-crm-csv";

function asImportRow(data: Prisma.JsonValue) {
  return data as unknown as NormalizedCrmCustomerImportRow;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function stageCrmCustomerCsvImport(
  rows: CrmCustomerCsvRow[],
  fileName: string
) {
  const normalizedInputs = rows.map((source, index) => {
    const phoneE164 = normalize_phone_e164_br(source.Telefone || "");
    const { legacyCustomerId, name } = normalizeCrmCustomerName(source.Nome);
    return {
      rowNumber: index + 2,
      source,
      phoneE164,
      legacyCustomerId,
      name,
    };
  });

  const validPhones = [
    ...new Set(
      normalizedInputs.flatMap((row) => (row.phoneE164 ? [row.phoneE164] : []))
    ),
  ];
  const matches = new Map<
    string,
    Awaited<ReturnType<typeof prisma.crmCustomer.findMany>>[number]
  >();
  for (const phoneBatch of chunks(validPhones, 500)) {
    const customers = await prisma.crmCustomer.findMany({
      where: { phone_e164: { in: phoneBatch } },
    });
    customers.forEach((customer) => matches.set(customer.phone_e164, customer));
  }

  const stagedRows: NormalizedCrmCustomerImportRow[] = normalizedInputs.map(
    (input) => {
      const match = input.phoneE164 ? matches.get(input.phoneE164) : undefined;
      const suggestion = suggestCrmCustomerImportDecision({
        phoneE164: input.phoneE164,
        importedName: input.name,
        existingName: match?.name,
        hasMatch: Boolean(match),
      });
      const ordersCount = parseNonNegativeInteger(
        input.source["Nº pedidos"] || input.source.Frequência
      );
      const totalRevenue = parseBrCurrency(input.source["Total gasto"]);
      const sourceAvgTicket = parseBrCurrency(input.source.Ticket);

      return {
        rowNumber: input.rowNumber,
        source: input.source,
        normalized: {
          phoneE164: input.phoneE164,
          legacyCustomerId: input.legacyCustomerId,
          name: input.name,
          neighborhood: input.source.Bairro?.trim() || null,
          firstOrderAt: parseBrDate(input.source["1ª compra"]),
          lastOrderAt: parseBrDate(input.source["Últ. compra"]),
          ordersCount,
          totalRevenue,
          avgTicket:
            sourceAvgTicket || (ordersCount ? totalRevenue / ordersCount : 0),
          classifications: normalizeClassification(input.source.Classificação),
          birthday: parseBrDate(input.source.Aniversário),
        },
        match: match
          ? {
              customerId: match.id,
              name: match.name,
              phoneE164: match.phone_e164,
              neighborhood: match.neighborhood,
              firstOrderAt: match.first_order_at?.toISOString() || null,
              lastOrderAt: match.last_order_at?.toISOString() || null,
              ordersCount: match.orders_count,
              totalRevenue: Number(match.total_revenue),
              avgTicket: Number(match.avg_ticket),
            }
          : null,
        decision: suggestion.decision,
        suggestedDecision: suggestion.decision,
        reason: suggestion.reason,
        appliedAt: null,
      };
    }
  );

  let profile = await prisma.importProfile.findFirst({
    where: { table: IMPORT_PROFILE_TABLE },
  });
  if (!profile) {
    profile = await prisma.importProfile.create({
      data: {
        name: "Importação guiada de clientes do CRM",
        description: "Staging revisável antes do merge/criação no CRM",
        table: IMPORT_PROFILE_TABLE,
        domainClass: "CrmCustomer",
        type: "csv",
        createdAt: new Date(),
      },
    });
  }

  const session = await prisma.importSession.create({
    data: {
      importProfileId: profile.id,
      description: `${fileName || "clientes.csv"} · ${
        stagedRows.length
      } registros`,
      createdAt: new Date(),
    },
  });

  for (const recordBatch of chunks(stagedRows, 500)) {
    await prisma.importSessionRecord.createMany({
      data: recordBatch.map((row) => ({
        importSessionId: session.id,
        data: row as unknown as Prisma.InputJsonValue,
        createdAt: new Date(),
      })),
    });
  }

  return session.id;
}

export async function updateCrmCustomerImportDecision(params: {
  sessionId: string;
  recordId: string;
  decision: CrmCustomerImportDecision;
}) {
  const record = await prisma.importSessionRecord.findFirst({
    where: { id: params.recordId, importSessionId: params.sessionId },
  });
  if (!record) throw new Error("Registro da importação não encontrado");
  const data = asImportRow(record.data);
  await prisma.importSessionRecord.update({
    where: { id: record.id },
    data: {
      data: {
        ...data,
        decision: params.decision,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function updateCrmCustomerImportDecisions(params: {
  sessionId: string;
  from: CrmCustomerImportDecision;
  to: CrmCustomerImportDecision;
}) {
  const records = await prisma.importSessionRecord.findMany({
    where: { importSessionId: params.sessionId },
    select: { id: true, data: true },
  });
  const selected = records.filter(
    (record) => asImportRow(record.data).decision === params.from
  );
  for (const batch of chunks(selected, 100)) {
    await prisma.$transaction(
      batch.map((record) => {
        const data = asImportRow(record.data);
        return prisma.importSessionRecord.update({
          where: { id: record.id },
          data: {
            data: {
              ...data,
              decision: params.to,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      })
    );
  }
  return selected.length;
}

function chooseEarliest(current: string | null, incoming: string | null) {
  if (!current) return incoming;
  if (!incoming) return current;
  return new Date(incoming) < new Date(current) ? incoming : current;
}

function chooseLatest(current: string | null, incoming: string | null) {
  if (!current) return incoming;
  if (!incoming) return current;
  return new Date(incoming) > new Date(current) ? incoming : current;
}

export async function applyCrmCustomerCsvImport(sessionId: string) {
  const claimed = await prisma.importSession.updateMany({
    where: { id: sessionId, loaded: false, transformed: false },
    data: { transformed: true },
  });
  if (claimed.count !== 1)
    throw new Error("Esta importação já foi aplicada ou está em processamento");

  try {
    const records = await prisma.importSessionRecord.findMany({
      where: { importSessionId: sessionId },
      orderBy: { createdAt: "asc" },
    });
    const actionable = records.filter((record) => {
      const decision = asImportRow(record.data).decision;
      return decision === "create" || decision === "merge";
    });
    let created = 0;
    let merged = 0;

    for (const recordBatch of chunks(actionable, 50)) {
      await prisma.$transaction(
        async (tx) => {
          for (const record of recordBatch) {
            const row = asImportRow(record.data);
            const phone = row.normalized.phoneE164;
            if (!phone) continue;
            const existing = await tx.crmCustomer.findUnique({
              where: { phone_e164: phone },
            });
            const isCreate = !existing;
            const firstOrderAt = chooseEarliest(
              existing?.first_order_at?.toISOString() || null,
              row.normalized.firstOrderAt
            );
            const lastOrderAt = chooseLatest(
              existing?.last_order_at?.toISOString() || null,
              row.normalized.lastOrderAt
            );
            const useIncomingMetrics =
              !existing?.last_order_at ||
              Boolean(
                row.normalized.lastOrderAt &&
                  new Date(row.normalized.lastOrderAt) >= existing.last_order_at
              );

            const customer = await tx.crmCustomer.upsert({
              where: { phone_e164: phone },
              create: {
                phone_e164: phone,
                name: row.normalized.name,
                neighborhood: row.normalized.neighborhood,
                first_order_at: firstOrderAt ? new Date(firstOrderAt) : null,
                last_order_at: lastOrderAt ? new Date(lastOrderAt) : null,
                orders_count: row.normalized.ordersCount,
                total_revenue: row.normalized.totalRevenue,
                avg_ticket: row.normalized.avgTicket,
              },
              update: {
                name: existing?.name || row.normalized.name,
                neighborhood:
                  existing?.neighborhood || row.normalized.neighborhood,
                first_order_at: firstOrderAt ? new Date(firstOrderAt) : null,
                last_order_at: lastOrderAt ? new Date(lastOrderAt) : null,
                ...(useIncomingMetrics
                  ? {
                      orders_count: row.normalized.ordersCount,
                      total_revenue: row.normalized.totalRevenue,
                      avg_ticket: row.normalized.avgTicket,
                    }
                  : {}),
              },
            });

            for (const label of row.normalized.classifications) {
              const key = classificationTagKey(label);
              const tag = await tx.crmCustomerTag.upsert({
                where: { key },
                update: { label },
                create: { key, label },
              });
              await tx.crmCustomerTagLink.upsert({
                where: {
                  customer_id_tag_id: {
                    customer_id: customer.id,
                    tag_id: tag.id,
                  },
                },
                update: {},
                create: { customer_id: customer.id, tag_id: tag.id },
              });
            }

            const externalId = `${sessionId}:${record.id}`;
            const eventExists = await tx.crmCustomerEvent.findFirst({
              where: { source: IMPORT_SOURCE, external_id: externalId },
              select: { id: true },
            });
            if (!eventExists) {
              await tx.crmCustomerEvent.create({
                data: {
                  customer_id: customer.id,
                  event_type: isCreate ? "PROFILE_CREATE" : "PROFILE_UPDATE",
                  source: IMPORT_SOURCE,
                  external_id: externalId,
                  payload: {
                    action: isCreate
                      ? "customer_import_create"
                      : "customer_import_merge",
                    importSessionId: sessionId,
                    sourceRow: row.rowNumber,
                    legacyCustomerId: row.normalized.legacyCustomerId,
                    birthdayNotImported: row.normalized.birthday,
                  },
                  payload_raw: "guided_customer_csv_import",
                },
              });
            }
            await tx.importSessionRecord.update({
              where: { id: record.id },
              data: {
                data: {
                  ...row,
                  appliedAt: new Date().toISOString(),
                } as unknown as Prisma.InputJsonValue,
              },
            });
            if (isCreate) created += 1;
            else merged += 1;
          }
        },
        { timeout: 30_000 }
      );
    }

    await prisma.importSession.update({
      where: { id: sessionId },
      data: { loaded: true },
    });
    return { created, merged, ignored: records.length - actionable.length };
  } catch (error) {
    await prisma.importSession.updateMany({
      where: { id: sessionId, loaded: false },
      data: { transformed: false },
    });
    throw error;
  }
}

export function summarizeCrmCustomerImportRows(
  rows: NormalizedCrmCustomerImportRow[]
) {
  return rows.reduce(
    (summary, row) => {
      summary[row.decision] += 1;
      if (row.normalized.birthday) summary.birthdaysNotImported += 1;
      return summary;
    },
    { create: 0, merge: 0, ignore: 0, pending: 0, birthdaysNotImported: 0 }
  );
}
