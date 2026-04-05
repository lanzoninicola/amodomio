import { createHash, randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import prismaClient from '~/lib/prisma/client.server';
import { itemVariationPrismaEntity } from '~/domain/item/item-variation.prisma.entity.server';
import { itemCostVariationPrismaEntity } from '~/domain/item/item-cost-variation.prisma.entity.server';
import { isItemCostExcludedFromMetrics, normalizeItemCostToConsumptionUnit } from '~/domain/item/item-cost-metrics.server';

const SOURCE_SYSTEM = 'saipos';
const SOURCE_TYPE_FILE = 'file_upload';
const SOURCE_TYPE_VISION = 'photo_vision';
const SOURCE_TYPE_API = 'rest_api';
const ALIAS_SOURCE_TYPE = 'entrada_nf'; // compartilhado entre todos os tipos de importação
const COST_REFERENCE_TYPE_LINE = 'stock-movement-import-line';
const COST_REFERENCE_TYPE_MOVEMENT = 'stock-movement';
const COST_DISCREPANCY_THRESHOLD = 0.3;

export type BatchSummary = {
  total: number;
  ready: number;
  readyToImport: number;
  invalid: number;
  pendingMapping: number;
  pendingSupplier: number;
  pendingConversion: number;
  pendingCostReview: number;
  imported: number;
  ignored: number;
  skippedDuplicate: number;
  error: number;
};

export type BatchImportProgress = {
  status: 'idle' | 'importing' | 'imported' | 'failed';
  processedCount: number;
  errorCount: number;
  totalCount: number;
  remainingCount: number;
  message: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

type SupplierNoteEntry = {
  invoiceNumber: string | null;
  invoiceNumberNormalized: string | null;
  supplierName: string | null;
  supplierNameNormalized: string | null;
  supplierCnpj: string | null;
  supplierCnpjDigits: string | null;
  dataEntrada: Date | null;
  dataEmissao: Date | null;
  dataCadastro: Date | null;
  raw: Record<string, unknown>;
};

function str(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeName(value: unknown) {
  return str(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function movementMetadataBase(params: {
  batchId: string;
  lineId: string;
  line: any;
  sourceAction?: string;
}) {
  const quantityAmount = params.line?.qtyEntry ?? params.line?.qtyConsumption ?? null;
  const quantityUnit = params.line?.unitEntry || params.line?.unitConsumption || params.line?.movementUnit || null;

  return {
    importBatchId: params.batchId,
    importLineId: params.lineId,
    direction: 'entry',
    movementType: 'import',
    sourceSystem: SOURCE_SYSTEM,
    sourceType: SOURCE_TYPE,
    ingredientName: params.line?.ingredientName || null,
    invoiceNumber: params.line?.invoiceNumber || null,
    supplierId: params.line?.supplierId || null,
    supplierName: params.line?.supplierName || null,
    supplierCnpj: params.line?.supplierCnpj || null,
    supplierMatchSource: params.line?.supplierMatchSource || null,
    quantityAmount,
    quantityUnit,
    movementUnit: params.line?.movementUnit || null,
    targetUnit: params.line?.targetUnit || null,
    conversionSource: params.line?.conversionSource || null,
    conversionFactorUsed: params.line?.conversionFactorUsed ?? null,
    qtyEntry: params.line?.qtyEntry ?? null,
    qtyConsumption: params.line?.qtyConsumption ?? null,
    rawCostAmount: params.line?.costAmount ?? null,
    rawCostTotalAmount: params.line?.costTotalAmount ?? null,
    sourceFingerprint: params.line?.sourceFingerprint || null,
    ...(params.sourceAction ? { sourceAction: params.sourceAction } : {}),
  };
}

function digitsOnly(value: unknown) {
  return str(value).replace(/\D/g, '');
}

function normalizeInvoiceNumber(value: unknown) {
  const raw = str(value).toUpperCase();
  if (!raw) return null;
  return raw.replace(/\s+/g, '').replace(/^0+(?=\d)/, '') || '0';
}

function isSupportedStockEntryReason(value: unknown) {
  const normalized = normalizeName(value);
  if (!normalized) return true;
  return normalized.startsWith('ENTRADA');
}

function parsePtBrDateTime(value: unknown): Date | null {
  const raw = str(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = match;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePtBrDecimal(value: unknown): number | null {
  const raw = str(value).replace(/\./g, '').replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDotDecimal(value: unknown): number | null {
  const raw = str(value).replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseQtyUnitCell(value: unknown): { quantity: number | null; unit: string | null } {
  const raw = str(value);
  if (!raw) return { quantity: null, unit: null };

  const parts = raw.split('/').map((p) => p.trim());
  if (parts.length >= 2) {
    return {
      quantity: parsePtBrDecimal(parts[0]),
      unit: str(parts[1]).toUpperCase() || null,
    };
  }

  return { quantity: parsePtBrDecimal(raw), unit: null };
}

function extractInvoiceNumber(value: unknown) {
  const raw = str(value);
  if (!raw) return null;

  const explicitMatch = raw.match(/(?:NF(?:-E)?|NOTA\s+FISCAL|CUPOM(?:\s+FISCAL)?)\s*[:#-]?\s*([A-Za-z0-9\-./]+)/i);
  if (explicitMatch?.[1]) return explicitMatch[1];

  return null;
}

function hashFingerprint(input: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function buildSyntheticVisionInvoiceNumber(params: {
  movementAt?: Date | null;
  supplierName?: string | null;
  supplierCnpj?: string | null;
  lines: Array<{
    ingredientName?: string | null;
    qtyEntry?: number | null;
    costAmount?: number | null;
  }>;
}) {
  const datePart = params.movementAt
    ? [
        params.movementAt.getFullYear(),
        String(params.movementAt.getMonth() + 1).padStart(2, '0'),
        String(params.movementAt.getDate()).padStart(2, '0'),
      ].join('')
    : 'sem-data';
  const supplierPart = digitsOnly(params.supplierCnpj) || normalizeName(params.supplierName || '').slice(0, 12) || 'sem-fornecedor';
  const linesSignature = params.lines
    .map((line) => `${normalizeName(line.ingredientName || '')}|${Number(line.qtyEntry ?? 0)}|${Number(line.costAmount ?? 0)}`)
    .join('::');
  const fingerprint = createHash('sha1')
    .update(`${datePart}|${supplierPart}|${linesSignature}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  return `CUPOM-${datePart}-${fingerprint}`;
}

function isEmptyRow(row: unknown[]) {
  return row.every((v) => str(v) === '');
}

function findHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) => normalizeName(row?.[0]) === 'DATA:' && normalizeName(row?.[1]) === 'INGREDIENTE');
}

async function loadItemsAndAliases() {
  const db = prismaClient as any;
  const [items, aliases, suppliers] = await Promise.all([
    db.item.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        purchaseUm: true,
        consumptionUm: true,
        purchaseToConsumptionFactor: true,
        ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
      },
      orderBy: [{ name: 'asc' }],
    }),
    typeof db.itemImportAlias?.findMany === 'function'
      ? db.itemImportAlias.findMany({
          where: { active: true, sourceSystem: SOURCE_SYSTEM, sourceType: ALIAS_SOURCE_TYPE },
          select: { id: true, aliasName: true, aliasNormalized: true, itemId: true },
        })
      : [],
    typeof db.supplier?.findMany === 'function'
      ? db.supplier.findMany({
          select: { id: true, name: true, cnpj: true },
          orderBy: [{ name: 'asc' }],
        })
      : [],
  ]);

  const itemsByNormalized = new Map<string, any[]>();
  for (const item of items) {
    const key = normalizeName(item.name);
    const arr = itemsByNormalized.get(key) || [];
    arr.push(item);
    itemsByNormalized.set(key, arr);
  }

  const aliasByNormalized = new Map<string, any>();
  for (const alias of aliases || []) {
    aliasByNormalized.set(String(alias.aliasNormalized || ''), alias);
  }

  const itemsById = new Map<string, any>(items.map((i: any) => [i.id, i]));
  const suppliersById = new Map<string, any>();
  const suppliersByCnpjDigits = new Map<string, any[]>();
  const suppliersByNameNormalized = new Map<string, any[]>();

  for (const supplier of suppliers || []) {
    suppliersById.set(String(supplier.id), supplier);

    const cnpjDigits = digitsOnly(supplier.cnpj);
    if (cnpjDigits) {
      const list = suppliersByCnpjDigits.get(cnpjDigits) || [];
      list.push(supplier);
      suppliersByCnpjDigits.set(cnpjDigits, list);
    }

    const normalizedName = normalizeName(supplier.name);
    if (normalizedName) {
      const list = suppliersByNameNormalized.get(normalizedName) || [];
      list.push(supplier);
      suppliersByNameNormalized.set(normalizedName, list);
    }
  }

  return {
    items,
    itemsById,
    itemsByNormalized,
    aliasByNormalized,
    suppliersById,
    suppliersByCnpjDigits,
    suppliersByNameNormalized,
  };
}

function chooseAutoMapping(ingredientName: string, lookup: Awaited<ReturnType<typeof loadItemsAndAliases>>) {
  const normalized = normalizeName(ingredientName);
  const exact = lookup.itemsByNormalized.get(normalized);
  if (exact?.length === 1) {
    return { item: exact[0], source: 'exact' };
  }

  const alias = lookup.aliasByNormalized.get(normalized);
  if (alias) {
    const item = lookup.itemsById.get(alias.itemId);
    if (item) return { item, source: 'alias' };
  }

  return { item: null, source: null };
}

function buildSuggestions(ingredientName: string, items: any[], limit = 5) {
  const normalized = normalizeName(ingredientName);
  const tokens = normalized.split(' ').filter(Boolean);
  return items
    .map((item) => {
      const itemNorm = normalizeName(item.name);
      let score = 0;
      if (itemNorm === normalized) score += 100;
      if (itemNorm.includes(normalized) || normalized.includes(itemNorm)) score += 50;
      for (const token of tokens) {
        if (token.length >= 3 && itemNorm.includes(token)) score += 10;
      }
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || String(a.item.name).localeCompare(String(b.item.name), 'pt-BR'))
    .slice(0, limit)
    .map((row) => ({ id: row.item.id, name: row.item.name, score: row.score }));
}

function parseSupplierNotesJson(fileBuffer?: Buffer | null) {
  if (!fileBuffer || fileBuffer.length === 0) return [];

  const parsed = JSON.parse(fileBuffer.toString('utf-8'));
  const notes = Array.isArray(parsed?.notas) ? parsed.notas : Array.isArray(parsed) ? parsed : null;
  if (!notes) {
    throw new Error('JSON de notas inválido: esperado objeto com "notas" ou um array de notas');
  }

  return notes.map((note: any) => ({
    invoiceNumber: str(note?.numero) || null,
    invoiceNumberNormalized: normalizeInvoiceNumber(note?.numero),
    supplierName: str(note?.fornecedor) || null,
    supplierNameNormalized: normalizeName(note?.fornecedor),
    supplierCnpj: str(note?.cnpj) || null,
    supplierCnpjDigits: digitsOnly(note?.cnpj) || null,
    dataEntrada: parsePtBrDateTime(note?.data_entrada),
    dataEmissao: parsePtBrDateTime(note?.data_emissao),
    dataCadastro: parsePtBrDateTime(note?.data_cadastro),
    raw: note,
  })) as SupplierNoteEntry[];
}

function sameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildSupplierNotesLookup(notes: SupplierNoteEntry[]) {
  const notesByInvoiceNumber = new Map<string, SupplierNoteEntry[]>();

  for (const note of notes) {
    if (!note.invoiceNumberNormalized) continue;
    const list = notesByInvoiceNumber.get(note.invoiceNumberNormalized) || [];
    list.push(note);
    notesByInvoiceNumber.set(note.invoiceNumberNormalized, list);
  }

  return { notesByInvoiceNumber };
}

function matchSupplierNoteForLine(
  line: { invoiceNumber?: string | null; movementAt?: Date | null },
  notesLookup: ReturnType<typeof buildSupplierNotesLookup> | null,
) {
  if (!notesLookup) return null;

  const invoiceNumberNormalized = normalizeInvoiceNumber(line.invoiceNumber);
  if (!invoiceNumberNormalized) return null;

  const candidates = notesLookup.notesByInvoiceNumber.get(invoiceNumberNormalized) || [];
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const exactByEntryDate = candidates.filter((candidate) => sameDay(candidate.dataEntrada, line.movementAt || null));
  if (exactByEntryDate.length === 1) return exactByEntryDate[0];

  const exactByEmissionDate = candidates.filter((candidate) => sameDay(candidate.dataEmissao, line.movementAt || null));
  if (exactByEmissionDate.length === 1) return exactByEmissionDate[0];

  const exactByRegisterDate = candidates.filter((candidate) => sameDay(candidate.dataCadastro, line.movementAt || null));
  if (exactByRegisterDate.length === 1) return exactByRegisterDate[0];

  const uniqueSuppliers = new Set(
    candidates.map((candidate) => `${candidate.supplierCnpjDigits || ''}|${candidate.supplierNameNormalized || ''}`),
  );
  if (uniqueSuppliers.size === 1) return candidates[0];

  return null;
}

function resolveSupplierFromLookup(
  note: SupplierNoteEntry | null,
  lookup: Awaited<ReturnType<typeof loadItemsAndAliases>>,
) {
  if (!note) {
    return {
      supplierId: null,
      supplierName: null,
      supplierNameNormalized: null,
      supplierCnpj: null,
      supplierMatchSource: null,
    };
  }

  if (note.supplierCnpjDigits) {
    const suppliers = lookup.suppliersByCnpjDigits.get(note.supplierCnpjDigits) || [];
    if (suppliers.length === 1) {
      return {
        supplierId: suppliers[0].id,
        supplierName: note.supplierName,
        supplierNameNormalized: note.supplierNameNormalized,
        supplierCnpj: note.supplierCnpj,
        supplierMatchSource: 'notes_json_cnpj',
      };
    }
  }

  if (note.supplierNameNormalized) {
    const suppliers = lookup.suppliersByNameNormalized.get(note.supplierNameNormalized) || [];
    if (suppliers.length === 1) {
      return {
        supplierId: suppliers[0].id,
        supplierName: note.supplierName,
        supplierNameNormalized: note.supplierNameNormalized,
        supplierCnpj: note.supplierCnpj,
        supplierMatchSource: 'notes_json_name',
      };
    }
  }

  return {
    supplierId: null,
    supplierName: note.supplierName,
    supplierNameNormalized: note.supplierNameNormalized,
    supplierCnpj: note.supplierCnpj,
    supplierMatchSource: 'notes_json_unmatched',
  };
}

function buildSupplierReconciliationState(input: {
  supplierId?: string | null;
  supplierName?: string | null;
  supplierCnpj?: string | null;
  supplierMatchSource?: string | null;
  manual?: boolean;
}) {
  const supplierId = str(input.supplierId) || null;
  const supplierName = str(input.supplierName) || null;
  const supplierCnpj = str(input.supplierCnpj) || null;
  const supplierMatchSource = str(input.supplierMatchSource) || null;

  if (supplierId) {
    return {
      supplierReconciliationStatus: input.manual ? 'manual' : 'matched',
      supplierReconciliationSource: supplierMatchSource || (input.manual ? 'manual' : 'matched'),
      supplierReconciliationAt: new Date(),
    };
  }

  if (supplierName || supplierCnpj) {
    return {
      supplierReconciliationStatus: 'unmatched',
      supplierReconciliationSource: supplierMatchSource || null,
      supplierReconciliationAt: new Date(),
    };
  }

  return {
    supplierReconciliationStatus: 'not_started',
    supplierReconciliationSource: null,
    supplierReconciliationAt: null,
  };
}

function lineHasSupplierReconciled(line: any) {
  const status = str(line?.supplierReconciliationStatus).toLowerCase();
  if (status === 'matched' || status === 'manual') return true;
  return Boolean(str(line?.supplierId));
}

function lineNeedsSupplierReconciliation(line: any) {
  const status = str(line?.status).toLowerCase();
  if (['invalid', 'ignored', 'skipped_duplicate'].includes(status)) return false;
  if (!str(line?.invoiceNumber)) return false;
  return !lineHasSupplierReconciled(line);
}

async function getMeasurementConversion(fromUnit: string, toUnit: string) {
  const db = prismaClient as any;
  const from = str(fromUnit).toUpperCase();
  const to = str(toUnit).toUpperCase();
  if (!from || !to || from === to) return null;

  const rows = await db.measurementUnitConversion.findMany({
    where: {
      active: true,
      OR: [
        {
          FromUnit: { is: { code: from } },
          ToUnit: { is: { code: to } },
        },
        {
          FromUnit: { is: { code: to } },
          ToUnit: { is: { code: from } },
        },
      ],
    },
    include: {
      FromUnit: { select: { code: true } },
      ToUnit: { select: { code: true } },
    },
    take: 2,
  });

  for (const row of rows) {
    const rowFrom = str(row?.FromUnit?.code).toUpperCase();
    const rowTo = str(row?.ToUnit?.code).toUpperCase();
    const factor = Number(row?.factor ?? NaN);
    if (!(factor > 0)) continue;
    if (rowFrom === from && rowTo === to) {
      return { factor, mode: 'direct' as const };
    }
    if (rowFrom === to && rowTo === from) {
      return { factor, mode: 'reverse' as const };
    }
  }

  return null;
}

function resolveTargetUnit(item: any) {
  return str(item?.consumptionUm || item?.purchaseUm).toUpperCase() || null;
}

function resolveLatestCostHint(params: {
  currentRows: any[];
  historyRows: any[];
}) {
  const firstHistoryRow = params.historyRows[0];
  const item = firstHistoryRow?.ItemVariation?.Item || params.currentRows[0]?.ItemVariation?.Item || {};

  for (const row of params.historyRows) {
    if (isItemCostExcludedFromMetrics(row)) continue;
    const normalized = normalizeItemCostToConsumptionUnit(
      { costAmount: row.costAmount, unit: row.unit, source: row.source },
      item,
    );
    if (Number.isFinite(normalized) && Number(normalized) > 0) {
      return Number(normalized);
    }
  }

  for (const row of params.currentRows) {
    const normalized = normalizeItemCostToConsumptionUnit(
      { costAmount: row.costAmount, unit: row.unit, source: row.source },
      row?.ItemVariation?.Item || item,
    );
    if (Number.isFinite(normalized) && Number(normalized) > 0) {
      return Number(normalized);
    }
  }

  return null;
}

async function getCurrentCostHintsByItemIds(itemIds: string[]) {
  const normalizedIds = Array.from(new Set(itemIds.map((id) => str(id)).filter(Boolean)));
  if (normalizedIds.length === 0) return {} as Record<string, { lastCostPerUnit: number | null }>;

  const db = prismaClient as any;
  const itemVariationSelect = {
    itemId: true,
    isReference: true,
    Item: {
      select: {
        purchaseUm: true,
        consumptionUm: true,
        purchaseToConsumptionFactor: true,
        ItemPurchaseConversion: {
          select: {
            purchaseUm: true,
            factor: true,
          },
        },
      },
    },
  };
  const [costRows, historyRows] = await Promise.all([
    db.itemCostVariation.findMany({
      where: { ItemVariation: { itemId: { in: normalizedIds }, deletedAt: null } },
      select: { costAmount: true, unit: true, source: true, ItemVariation: { select: itemVariationSelect } },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    }),
    db.itemCostVariationHistory.findMany({
      where: { ItemVariation: { itemId: { in: normalizedIds }, deletedAt: null } },
      select: {
        costAmount: true,
        unit: true,
        source: true,
        metadata: true,
        validFrom: true,
        createdAt: true,
        ItemVariation: { select: itemVariationSelect },
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const itemCostHints: Record<string, { lastCostPerUnit: number | null }> = {};
  const currentRowsByItemId = new Map<string, any[]>();
  for (const row of costRows as any[]) {
    const itemId = str(row?.ItemVariation?.itemId);
    if (!itemId) continue;
    if (!currentRowsByItemId.has(itemId)) currentRowsByItemId.set(itemId, []);
    currentRowsByItemId.get(itemId)!.push(row);
  }

  const historyRowsByItemId = new Map<string, any[]>();
  for (const row of historyRows as any[]) {
    const itemId = str(row?.ItemVariation?.itemId);
    if (!itemId) continue;
    if (!historyRowsByItemId.has(itemId)) historyRowsByItemId.set(itemId, []);
    historyRowsByItemId.get(itemId)!.push(row);
  }

  for (const itemId of normalizedIds) {
    itemCostHints[itemId] = {
      lastCostPerUnit: resolveLatestCostHint({
        currentRows: currentRowsByItemId.get(itemId) || [],
        historyRows: historyRowsByItemId.get(itemId) || [],
      }),
    };
  }

  return itemCostHints;
}

function getCostReviewApprovalMetadata(line: any) {
  const metadata =
    typeof line?.metadata === 'object' && line.metadata && !Array.isArray(line.metadata)
      ? (line.metadata as Record<string, any>)
      : null;
  const approval =
    metadata && typeof metadata.costReviewApproval === 'object' && metadata.costReviewApproval && !Array.isArray(metadata.costReviewApproval)
      ? (metadata.costReviewApproval as Record<string, any>)
      : null;
  return approval;
}

function sameNumberish(a: unknown, b: unknown, epsilon = 1e-9) {
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isFinite(numA) && !Number.isFinite(numB)) return true;
  if (!Number.isFinite(numA) || !Number.isFinite(numB)) return false;
  return Math.abs(numA - numB) <= epsilon;
}

function isCostReviewApprovalValid(line: any, convertedCostAmount: number | null, targetUnit: string | null) {
  const approval = getCostReviewApprovalMetadata(line);
  if (!approval) return false;

  return (
    str(approval.mappedItemId) === str(line?.mappedItemId) &&
    str(approval.targetUnit).toUpperCase() === str(targetUnit).toUpperCase() &&
    str(approval.movementUnit).toUpperCase() === str(line?.movementUnit).toUpperCase() &&
    sameNumberish(approval.costAmount, line?.costAmount) &&
    sameNumberish(approval.convertedCostAmount, convertedCostAmount) &&
    sameNumberish(approval.manualConversionFactor, line?.manualConversionFactor)
  );
}

function resolveReadyStatusWithCostReview(params: {
  line: any;
  status: string;
  mappedItemId?: string | null;
  convertedCostAmount?: number | null;
  targetUnit?: string | null;
  costHintsByItemId: Record<string, { lastCostPerUnit: number | null }>;
}) {
  if (params.status !== 'ready') {
    return {
      status: params.status,
      errorCode: null,
      errorMessage: null,
    };
  }

  const mappedItemId = str(params.mappedItemId || params.line?.mappedItemId) || null;
  if (!mappedItemId) {
    return {
      status: params.status,
      errorCode: null,
      errorMessage: null,
    };
  }

  const hint = params.costHintsByItemId[mappedItemId];
  const lastCostPerUnit = Number(hint?.lastCostPerUnit ?? NaN);
  const convertedCostAmount = Number(params.convertedCostAmount ?? NaN);

  if (!(lastCostPerUnit > 0) || !(convertedCostAmount > 0)) {
    return {
      status: params.status,
      errorCode: null,
      errorMessage: null,
    };
  }

  const discrepancy = Math.abs(convertedCostAmount - lastCostPerUnit) / lastCostPerUnit;
  if (discrepancy <= COST_DISCREPANCY_THRESHOLD) {
    return {
      status: 'ready',
      errorCode: null,
      errorMessage: null,
    };
  }

  if (isCostReviewApprovalValid(params.line, convertedCostAmount, params.targetUnit || null)) {
    return {
      status: 'ready',
      errorCode: null,
      errorMessage: null,
    };
  }

  return {
    status: 'pending_cost_review',
    errorCode: 'cost_review_required',
    errorMessage: 'Linha com variacao relevante de custo. Revise e aprove antes de importar.',
  };
}

async function resolveConversionForLine(line: any, item: any) {
  const movementUnit = str(line.movementUnit || line.unitEntry || line.unitConsumption).toUpperCase() || null;
  const targetUnit = resolveTargetUnit(item);
  const costAmount = Number(line.costAmount ?? NaN);

  if (!Number.isFinite(costAmount) || costAmount <= 0) {
    return { status: 'invalid', errorCode: 'invalid_cost', errorMessage: 'Custo inválido' } as const;
  }

  if (!movementUnit) {
    return { status: 'pending_conversion', errorCode: 'missing_movement_unit', errorMessage: 'UM da movimentação não identificada' } as const;
  }

  if (!targetUnit) {
    return { status: 'pending_conversion', errorCode: 'item_unit_missing', errorMessage: 'Item sem UM configurada' } as const;
  }

  if (movementUnit === targetUnit) {
    return {
      status: 'ready',
      targetUnit,
      convertedCostAmount: costAmount,
      conversionSource: 'same-unit',
      conversionFactorUsed: 1,
    } as const;
  }

  const manualFactor = Number(line.manualConversionFactor ?? NaN);
  if (manualFactor > 0) {
    return {
      status: 'ready',
      targetUnit,
      convertedCostAmount: costAmount / manualFactor,
      conversionSource: 'manual',
      conversionFactorUsed: manualFactor,
    } as const;
  }

  const itemConsumptionUm = str(item?.consumptionUm).toUpperCase() || null;

  // Try multi-conversion table
  const itemConversions: Array<{ purchaseUm: string; factor: number }> = item?.ItemPurchaseConversion ?? [];
  const matchedConversion = itemConversions.find(
    (c) => str(c.purchaseUm).toUpperCase() === movementUnit
  );
  if (matchedConversion && itemConsumptionUm && targetUnit === itemConsumptionUm && matchedConversion.factor > 0) {
    return {
      status: 'ready',
      targetUnit,
      convertedCostAmount: costAmount / matchedConversion.factor,
      conversionSource: 'item_purchase_factor',
      conversionFactorUsed: matchedConversion.factor,
    } as const;
  }

  // Fallback to legacy single-conversion fields
  const itemPurchaseUm = str(item?.purchaseUm).toUpperCase() || null;
  const itemFactor = Number(item?.purchaseToConsumptionFactor ?? NaN);

  if (itemPurchaseUm && itemConsumptionUm && itemFactor > 0) {
    if (movementUnit === itemPurchaseUm && targetUnit === itemConsumptionUm) {
      return {
        status: 'ready',
        targetUnit,
        convertedCostAmount: costAmount / itemFactor,
        conversionSource: 'item_purchase_factor',
        conversionFactorUsed: itemFactor,
      } as const;
    }
    if (movementUnit === itemConsumptionUm && targetUnit === itemPurchaseUm) {
      return {
        status: 'ready',
        targetUnit,
        convertedCostAmount: costAmount * itemFactor,
        conversionSource: 'item_purchase_factor_reverse',
        conversionFactorUsed: itemFactor,
      } as const;
    }
  }

  const measured = await getMeasurementConversion(movementUnit, targetUnit);
  if (measured) {
    if (measured.mode === 'direct') {
      return {
        status: 'ready',
        targetUnit,
        convertedCostAmount: costAmount / measured.factor,
        conversionSource: 'measurement_conversion_direct',
        conversionFactorUsed: measured.factor,
      } as const;
    }

    return {
      status: 'ready',
      targetUnit,
      convertedCostAmount: costAmount * measured.factor,
      conversionSource: 'measurement_conversion_reverse',
      conversionFactorUsed: measured.factor,
    } as const;
  }

  return {
    status: 'pending_conversion',
    errorCode: 'conversion_not_found',
    errorMessage: `Sem conversão automática de ${movementUnit} para ${targetUnit}`,
    targetUnit,
  } as const;
}

async function classifyLine(
  line: any,
  lookup: Awaited<ReturnType<typeof loadItemsAndAliases>>,
  costHintsByItemId: Record<string, { lastCostPerUnit: number | null }>,
) {
  if (!isSupportedStockEntryReason(line.motivo)) {
    return {
      ...line,
      status: 'invalid',
      errorCode: 'motivo_not_supported',
      errorMessage: 'Motivo diferente de entrada de estoque',
    };
  }

  if (!line.movementAt) {
    return { ...line, status: 'invalid', errorCode: 'invalid_date', errorMessage: 'Data inválida' };
  }
  if (!line.invoiceNumber) {
    return { ...line, status: 'invalid', errorCode: 'missing_invoice', errorMessage: 'Documento fiscal não identificado' };
  }
  if (!(Number(line.costAmount) > 0)) {
    return { ...line, status: 'invalid', errorCode: 'invalid_cost', errorMessage: 'Custo inválido' };
  }

  const mapping = chooseAutoMapping(line.ingredientName, lookup);
  if (!mapping.item) {
    return {
      ...line,
      status: 'pending_mapping',
      errorCode: 'item_not_mapped',
      errorMessage: 'Ingrediente não mapeado',
      mappedItemId: null,
      mappedItemName: null,
      mappingSource: null,
    };
  }

  const conv = await resolveConversionForLine({ ...line, mappedItemId: mapping.item.id }, mapping.item);
  const reviewedStatus = resolveReadyStatusWithCostReview({
    line: { ...line, mappedItemId: mapping.item.id },
    status: conv.status,
    mappedItemId: mapping.item.id,
    convertedCostAmount: (conv as any).convertedCostAmount ?? null,
    targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(mapping.item),
    costHintsByItemId,
  });
  return {
    ...line,
    mappedItemId: mapping.item.id,
    mappedItemName: mapping.item.name,
    mappingSource: mapping.source,
    status: reviewedStatus.status,
    errorCode: conv.status === 'ready' ? reviewedStatus.errorCode : conv.errorCode,
    errorMessage: conv.status === 'ready' ? reviewedStatus.errorMessage : conv.errorMessage,
    targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(mapping.item),
    convertedCostAmount: (conv as any).convertedCostAmount ?? null,
    conversionSource: (conv as any).conversionSource ?? null,
    conversionFactorUsed: (conv as any).conversionFactorUsed ?? null,
  };
}

function summarizeLines(lines: any[]): BatchSummary {
  const summary: BatchSummary = {
    total: lines.length,
    ready: 0,
    readyToImport: 0,
    invalid: 0,
    pendingMapping: 0,
    pendingSupplier: 0,
    pendingConversion: 0,
    pendingCostReview: 0,
    imported: 0,
    ignored: 0,
    skippedDuplicate: 0,
    error: 0,
  };
  for (const line of lines) {
    if (lineNeedsSupplierReconciliation(line)) {
      summary.pendingSupplier += 1;
    }
    switch (String(line.status)) {
      case 'ready':
        summary.ready += 1;
        if (lineHasSupplierReconciled(line)) summary.readyToImport += 1;
        break;
      case 'invalid': summary.invalid += 1; break;
      case 'pending_mapping': summary.pendingMapping += 1; break;
      case 'pending_conversion': summary.pendingConversion += 1; break;
      case 'pending_cost_review': summary.pendingCostReview += 1; break;
      case 'imported': summary.imported += 1; break;
      case 'ignored': summary.ignored += 1; break;
      case 'skipped_duplicate': summary.skippedDuplicate += 1; break;
      case 'error': summary.error += 1; break;
      default: break;
    }
  }
  return summary;
}

function derivePreApplyBatchStatus(summary: BatchSummary) {
  if (summary.total === 0) return 'draft';
  if (summary.invalid || summary.pendingMapping || summary.pendingConversion || summary.pendingCostReview || summary.pendingSupplier) return 'draft';
  return 'validated';
}

async function markExistingAppliedDuplicates(lines: any[]) {
  const fingerprints = Array.from(new Set(lines.map((line) => line.sourceFingerprint).filter(Boolean)));
  if (fingerprints.length === 0) return new Set<string>();

  const db = prismaClient as any;
  const [existingMovements, existingLines] = await Promise.all([
    db.stockMovement.findMany({
      where: {
        deletedAt: null,
        ImportLine: {
          is: {
            sourceFingerprint: { in: fingerprints },
          },
        },
      },
      select: {
        ImportLine: {
          select: {
            sourceFingerprint: true,
          },
        },
      },
    }),
    db.stockMovementImportBatchLine.findMany({
      where: {
        sourceFingerprint: { in: fingerprints },
        StockMovements: {
          some: {
            deletedAt: null,
          },
        },
      },
      select: { sourceFingerprint: true },
    }),
  ]);

  const detected = new Set<string>();
  for (const row of existingMovements) {
    const fingerprint = String(row?.ImportLine?.sourceFingerprint || '').trim();
    if (fingerprint) detected.add(fingerprint);
  }

  for (const row of existingLines) {
    const fingerprint = String(row?.sourceFingerprint || '').trim();
    if (fingerprint) detected.add(fingerprint);
  }

  return detected;
}

async function hasActiveAppliedFingerprint(sourceFingerprint: string) {
  const fingerprint = String(sourceFingerprint || '').trim();
  if (!fingerprint) return false;

  const db = prismaClient as any;
  const existingMovement = await db.stockMovement.findFirst({
    where: {
      deletedAt: null,
      ImportLine: {
        is: {
          sourceFingerprint: fingerprint,
        },
      },
    },
    select: { id: true },
  });

  if (existingMovement?.id) return true;

  const existingLine = await db.stockMovementImportBatchLine.findFirst({
    where: {
      sourceFingerprint: fingerprint,
      StockMovements: {
        some: {
          deletedAt: null,
        },
      },
    },
    select: { id: true },
  });

  return Boolean(existingLine?.id);
}

export async function createStockMovementImportBatchFromFile(params: {
  fileName: string;
  fileBuffer: Buffer;
  batchName: string;
  uploadedBy?: string | null;
  supplierNotesFileName?: string | null;
  supplierNotesFileBuffer?: Buffer | null;
}) {
  const workbook = XLSX.read(params.fileBuffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Planilha sem abas');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
  const headerIndex = findHeaderRow(rows as unknown[][]);
  if (headerIndex < 0) {
    throw new Error('Cabeçalho da tabela não encontrado na planilha');
  }

  const filterRow = (rows[1] || []) as any[];
  const periodStart = parsePtBrDateTime(filterRow[0]) || parsePtBrDateTime((rows[1] || [])[0]);
  const periodEnd = parsePtBrDateTime(filterRow[1]) || parsePtBrDateTime((rows[1] || [])[1]);

  const lookup = await loadItemsAndAliases();
  const costHintsByItemId = await getCurrentCostHintsByItemIds(lookup.items.map((item: any) => item.id));
  const supplierNotes = parseSupplierNotesJson(params.supplierNotesFileBuffer || null);
  const supplierNotesLookup = supplierNotes.length > 0 ? buildSupplierNotesLookup(supplierNotes) : null;
  const parsedLines: any[] = [];
  const seenInBatch = new Map<string, string>();

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const rawRow = (rows[i] || []) as any[];
    if (!rawRow || rawRow.length === 0 || isEmptyRow(rawRow)) continue;

    const rowNumber = i + 1;
    const movementAt = parsePtBrDateTime(rawRow[0]);
    const ingredientName = str(rawRow[1]);
    const motivo = str(rawRow[2]);
    const identification = str(rawRow[3]);
    const entry = parseQtyUnitCell(rawRow[4]);
    const consumption = parseQtyUnitCell(rawRow[5]);
    const costAmount = parseDotDecimal(rawRow[6]);
    const costTotalAmount = parseDotDecimal(rawRow[7]);
    const observation = str(rawRow[8]) || null;
    const movementUnit = str(entry.unit || consumption.unit).toUpperCase() || null;
    const invoiceNumber = extractInvoiceNumber(identification);
    const matchedSupplierNote = matchSupplierNoteForLine({ invoiceNumber, movementAt }, supplierNotesLookup);
    const matchedSupplier = resolveSupplierFromLookup(matchedSupplierNote, lookup);
    const supplierReconciliation = buildSupplierReconciliationState(matchedSupplier);

    const sourceFingerprint = hashFingerprint({
      sourceSystem: SOURCE_SYSTEM,
      sourceType: SOURCE_TYPE_FILE,
      movementAt: movementAt?.toISOString() || str(rawRow[0]),
      ingredientName: normalizeName(ingredientName),
      invoiceNumber,
      qtyEntry: entry.quantity,
      unitEntry: entry.unit,
      qtyConsumption: consumption.quantity,
      unitConsumption: consumption.unit,
      costAmount,
      costTotalAmount,
    });

    let line = await classifyLine(
      {
        rowNumber,
        movementAt,
        ingredientName,
        ingredientNameNormalized: normalizeName(ingredientName),
        motivo,
        identification,
        invoiceNumber,
        supplierId: matchedSupplier.supplierId,
        supplierName: matchedSupplier.supplierName,
        supplierNameNormalized: matchedSupplier.supplierNameNormalized,
        supplierCnpj: matchedSupplier.supplierCnpj,
        supplierMatchSource: matchedSupplier.supplierMatchSource,
        ...supplierReconciliation,
        qtyEntry: entry.quantity,
        unitEntry: entry.unit,
        qtyConsumption: consumption.quantity,
        unitConsumption: consumption.unit,
        movementUnit,
        costAmount,
        costTotalAmount,
        observation,
        sourceFingerprint,
        rawData: {
          row: rawRow,
          cells: {
            data: rawRow[0],
            ingrediente: rawRow[1],
            motivo: rawRow[2],
            identificacao: rawRow[3],
            qtdEntrada: rawRow[4],
            qtdConsumo: rawRow[5],
            custo: rawRow[6],
            custoTotal: rawRow[7],
            observacao: rawRow[8],
          },
          supplierNote: matchedSupplierNote?.raw || null,
        },
      },
      lookup,
      costHintsByItemId,
    );

    const duplicateInBatchLineId = seenInBatch.get(sourceFingerprint);
    if (duplicateInBatchLineId) {
      line = {
        ...line,
        status: 'skipped_duplicate',
        errorCode: 'duplicate_in_batch',
        errorMessage: 'Linha duplicada no mesmo arquivo',
        duplicateOfLineId: duplicateInBatchLineId,
      };
    }

    const syntheticLineId = randomUUID();
    if (!seenInBatch.has(sourceFingerprint)) {
      seenInBatch.set(sourceFingerprint, syntheticLineId);
    }

    parsedLines.push({
      id: syntheticLineId,
      ...line,
      duplicateOfLineId: (line as any).duplicateOfLineId || null,
    });
  }

  const existingAppliedFingerprints = await markExistingAppliedDuplicates(parsedLines);
  const finalLines = parsedLines.map((line) => {
    if (existingAppliedFingerprints.has(line.sourceFingerprint)) {
      return {
        ...line,
        status: 'skipped_duplicate',
        errorCode: 'duplicate_already_applied',
        errorMessage: 'Linha já importada em lote anterior',
      };
    }
    return line;
  });

  const summary = summarizeLines(finalLines);
  const db = prismaClient as any;
  const batch = await db.stockMovementImportBatch.create({
    data: {
      name: str(params.batchName) || `Importação de movimentações ${new Date().toLocaleString('pt-BR')}`,
      sourceSystem: SOURCE_SYSTEM,
      sourceType: SOURCE_TYPE_FILE,
      status: derivePreApplyBatchStatus(summary),
      originalFileName: params.fileName,
      worksheetName: sheetName,
      supplierNotesFileName: params.supplierNotesFileName || null,
      supplierNotesAttachedAt: params.supplierNotesFileName || supplierNotes.length > 0 ? new Date() : null,
      periodStart,
      periodEnd,
      uploadedBy: params.uploadedBy || null,
      notes:
        params.supplierNotesFileName || supplierNotes.length > 0
          ? `JSON de notas vinculado: ${params.supplierNotesFileName || 'arquivo informado'}`
          : null,
      summary,
      Lines: {
        create: finalLines.map((line) => ({
          id: line.id,
          rowNumber: line.rowNumber,
          status: line.status,
          errorCode: line.errorCode || null,
          errorMessage: line.errorMessage || null,
          rawData: line.rawData,
          movementAt: line.movementAt || null,
          ingredientName: line.ingredientName || '',
          ingredientNameNormalized: line.ingredientNameNormalized || normalizeName(line.ingredientName),
          motivo: line.motivo || null,
          identification: line.identification || null,
          invoiceNumber: line.invoiceNumber || null,
          supplierId: line.supplierId || null,
          supplierName: line.supplierName || null,
          supplierNameNormalized: line.supplierNameNormalized || null,
          supplierCnpj: line.supplierCnpj || null,
          supplierMatchSource: line.supplierMatchSource || null,
          supplierReconciliationStatus: line.supplierReconciliationStatus || 'not_started',
          supplierReconciliationSource: line.supplierReconciliationSource || null,
          supplierReconciliationAt: line.supplierReconciliationAt || null,
          qtyEntry: line.qtyEntry,
          unitEntry: line.unitEntry || null,
          qtyConsumption: line.qtyConsumption,
          unitConsumption: line.unitConsumption || null,
          movementUnit: line.movementUnit || null,
          costAmount: line.costAmount,
          costTotalAmount: line.costTotalAmount,
          observation: line.observation || null,
          sourceFingerprint:
            line.errorCode === 'duplicate_in_batch'
              ? `${line.sourceFingerprint}_dup_${line.rowNumber}`
              : line.sourceFingerprint,
          duplicateOfLineId: line.duplicateOfLineId || null,
          mappedItemId: line.mappedItemId || null,
          mappedItemName: line.mappedItemName || null,
          mappingSource: line.mappingSource || null,
          manualConversionFactor: line.manualConversionFactor || null,
          conversionSource: line.conversionSource || null,
          conversionFactorUsed: line.conversionFactorUsed || null,
          targetUnit: line.targetUnit || null,
          convertedCostAmount: line.convertedCostAmount ?? null,
          metadata: line.metadata || null,
        })),
      },
    },
    select: { id: true },
  });

  return { batchId: batch.id, summary };
}

async function resolveDirectSupplierFromLookup(
  supplier: {
    supplierName?: string | null;
    supplierCnpj?: string | null;
  },
  lookup: Awaited<ReturnType<typeof loadItemsAndAliases>>,
) {
  const supplierName = str(supplier.supplierName) || null;
  const supplierNameNormalized = supplierName ? normalizeName(supplierName) : null;
  const supplierCnpj = str(supplier.supplierCnpj) || null;
  const supplierCnpjDigits = digitsOnly(supplierCnpj);

  if (supplierCnpjDigits) {
    const suppliers = lookup.suppliersByCnpjDigits.get(supplierCnpjDigits) || [];
    if (suppliers.length === 1) {
      return {
        supplierId: suppliers[0].id,
        supplierName,
        supplierNameNormalized,
        supplierCnpj,
        supplierMatchSource: 'chatgpt_cnpj',
      };
    }
  }

  if (supplierNameNormalized) {
    const suppliers = lookup.suppliersByNameNormalized.get(supplierNameNormalized) || [];
    if (suppliers.length === 1) {
      return {
        supplierId: suppliers[0].id,
        supplierName,
        supplierNameNormalized,
        supplierCnpj,
        supplierMatchSource: 'chatgpt_name',
      };
    }
  }

  if (supplierName) {
    const db = prismaClient as any;
    const createdSupplier = await db.supplier.create({
      data: {
        name: supplierName,
        cnpj: supplierCnpj,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
      },
    });

    const createdNameNormalized = normalizeName(createdSupplier.name);
    const createdCnpjDigits = digitsOnly(createdSupplier.cnpj);

    if (createdCnpjDigits) {
      const list = lookup.suppliersByCnpjDigits.get(createdCnpjDigits) || [];
      lookup.suppliersByCnpjDigits.set(createdCnpjDigits, [...list, createdSupplier]);
    }

    if (createdNameNormalized) {
      const list = lookup.suppliersByNameNormalized.get(createdNameNormalized) || [];
      lookup.suppliersByNameNormalized.set(createdNameNormalized, [...list, createdSupplier]);
    }

    return {
      supplierId: createdSupplier.id,
      supplierName,
      supplierNameNormalized,
      supplierCnpj,
      supplierMatchSource: 'chatgpt_auto_created',
    };
  }

  return {
    supplierId: null,
    supplierName,
    supplierNameNormalized,
    supplierCnpj,
    supplierMatchSource: supplierName || supplierCnpj ? 'chatgpt_unmatched' : null,
  };
}

export async function createStockMovementImportBatchFromVisionPayload(params: {
  batchName: string;
  sourceType?: typeof SOURCE_TYPE_VISION | typeof SOURCE_TYPE_API;
  uploadedBy?: string | null;
  originalFileName?: string | null;
  worksheetName?: string | null;
  notes?: string | null;
  movementAt?: Date | null;
  invoiceNumber?: string | null;
  supplierName?: string | null;
  supplierCnpj?: string | null;
  lines: Array<{
    rowNumber?: number | null;
    movementAt?: Date | null;
    ingredientName: string;
    motivo?: string | null;
    identification?: string | null;
    invoiceNumber?: string | null;
    supplierName?: string | null;
    supplierCnpj?: string | null;
    qtyEntry?: number | null;
    unitEntry?: string | null;
    qtyConsumption?: number | null;
    unitConsumption?: string | null;
    movementUnit?: string | null;
    costAmount?: number | null;
    costTotalAmount?: number | null;
    observation?: string | null;
    rawData?: Record<string, unknown> | null;
  }>;
}) {
  const lookup = await loadItemsAndAliases();
  const costHintsByItemId = await getCurrentCostHintsByItemIds(lookup.items.map((item: any) => item.id));
  const parsedLines: any[] = [];
  const seenInBatch = new Map<string, string>();
  const syntheticInvoiceNumber = params.invoiceNumber
    ? null
    : buildSyntheticVisionInvoiceNumber({
        movementAt: params.movementAt || null,
        supplierName: params.supplierName || null,
        supplierCnpj: params.supplierCnpj || null,
        lines: params.lines,
      });

  for (let index = 0; index < params.lines.length; index += 1) {
    const rawLine = params.lines[index];
    const movementAt = rawLine.movementAt || params.movementAt || null;
    const ingredientName = str(rawLine.ingredientName);
    const invoiceNumber = str(rawLine.invoiceNumber || params.invoiceNumber || syntheticInvoiceNumber) || null;
    const supplier = await resolveDirectSupplierFromLookup(
      {
        supplierName: rawLine.supplierName || params.supplierName,
        supplierCnpj: rawLine.supplierCnpj || params.supplierCnpj,
      },
      lookup,
    );
    const supplierReconciliation = buildSupplierReconciliationState(supplier);
    const qtyEntry = Number(rawLine.qtyEntry ?? NaN);
    const qtyConsumption = Number(rawLine.qtyConsumption ?? NaN);
    const costAmount = Number(rawLine.costAmount ?? NaN);
    const costTotalAmount = Number(rawLine.costTotalAmount ?? NaN);
    const rowNumber = Number(rawLine.rowNumber || index + 1);
    const movementUnit =
      str(rawLine.movementUnit || rawLine.unitEntry || rawLine.unitConsumption).toUpperCase() || null;

    const sourceFingerprint = hashFingerprint({
      sourceSystem: SOURCE_SYSTEM,
      sourceType: params.sourceType || SOURCE_TYPE_VISION,
      movementAt: movementAt?.toISOString() || '',
      ingredientName: normalizeName(ingredientName),
      invoiceNumber,
      qtyEntry: Number.isFinite(qtyEntry) ? qtyEntry : null,
      unitEntry: str(rawLine.unitEntry).toUpperCase() || null,
      qtyConsumption: Number.isFinite(qtyConsumption) ? qtyConsumption : null,
      unitConsumption: str(rawLine.unitConsumption).toUpperCase() || null,
      costAmount: Number.isFinite(costAmount) ? costAmount : null,
      costTotalAmount: Number.isFinite(costTotalAmount) ? costTotalAmount : null,
    });

    let line = await classifyLine(
      {
        rowNumber,
        movementAt,
        ingredientName,
        ingredientNameNormalized: normalizeName(ingredientName),
        motivo: str(rawLine.motivo) || 'Entrada por documento',
        identification: str(rawLine.identification) || (invoiceNumber ? `DOC: ${invoiceNumber}` : null),
        invoiceNumber,
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        supplierNameNormalized: supplier.supplierNameNormalized,
        supplierCnpj: supplier.supplierCnpj,
        supplierMatchSource: supplier.supplierMatchSource,
        ...supplierReconciliation,
        qtyEntry: Number.isFinite(qtyEntry) ? qtyEntry : null,
        unitEntry: str(rawLine.unitEntry).toUpperCase() || null,
        qtyConsumption: Number.isFinite(qtyConsumption) ? qtyConsumption : null,
        unitConsumption: str(rawLine.unitConsumption).toUpperCase() || null,
        movementUnit,
        costAmount: Number.isFinite(costAmount) ? costAmount : null,
        costTotalAmount: Number.isFinite(costTotalAmount) ? costTotalAmount : null,
        observation: str(rawLine.observation) || null,
        sourceFingerprint,
        rawData: rawLine.rawData || {
          source: 'chatgpt-vision',
          batchDefaults: {
            movementAt: params.movementAt?.toISOString() || null,
            invoiceNumber: params.invoiceNumber || null,
            syntheticInvoiceNumber: syntheticInvoiceNumber || null,
            supplierName: params.supplierName || null,
            supplierCnpj: params.supplierCnpj || null,
          },
        },
        metadata: {
          source: 'chatgpt-vision',
          invoiceNumberProvidedByModel: Boolean(rawLine.invoiceNumber || params.invoiceNumber),
          syntheticInvoiceNumber: syntheticInvoiceNumber || null,
        },
      },
      lookup,
      costHintsByItemId,
    );

    const duplicateInBatchLineId = seenInBatch.get(sourceFingerprint);
    if (duplicateInBatchLineId) {
      line = {
        ...line,
        status: 'skipped_duplicate',
        errorCode: 'duplicate_in_batch',
        errorMessage: 'Linha duplicada na mesma resposta',
        duplicateOfLineId: duplicateInBatchLineId,
      };
    }

    const syntheticLineId = randomUUID();
    if (!seenInBatch.has(sourceFingerprint)) {
      seenInBatch.set(sourceFingerprint, syntheticLineId);
    }

    parsedLines.push({
      id: syntheticLineId,
      ...line,
      duplicateOfLineId: (line as any).duplicateOfLineId || null,
    });
  }

  const existingAppliedFingerprints = await markExistingAppliedDuplicates(parsedLines);
  const finalLines = parsedLines.map((line) => {
    if (existingAppliedFingerprints.has(line.sourceFingerprint)) {
      return {
        ...line,
        status: 'skipped_duplicate',
        errorCode: 'duplicate_already_applied',
        errorMessage: 'Linha já importada em lote anterior',
      };
    }
    return line;
  });

  const summary = summarizeLines(finalLines);
  const db = prismaClient as any;
  const periodDates = finalLines
    .map((line) => line.movementAt)
    .filter((value) => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const periodStart = periodDates[0] || params.movementAt || null;
  const periodEnd = periodDates[periodDates.length - 1] || params.movementAt || null;

  const batch = await db.stockMovementImportBatch.create({
    data: {
      name: str(params.batchName) || `Importação de movimentações por foto ${new Date().toLocaleString('pt-BR')}`,
      sourceSystem: SOURCE_SYSTEM,
      sourceType: params.sourceType || SOURCE_TYPE_VISION,
      status: derivePreApplyBatchStatus(summary),
      originalFileName: str(params.originalFileName) || 'chatgpt-photo-import.json',
      worksheetName: str(params.worksheetName) || 'chatgpt-vision',
      supplierNotesFileName: null,
      supplierNotesAttachedAt: null,
      periodStart,
      periodEnd,
      uploadedBy: params.uploadedBy || null,
      notes: str(params.notes) || 'Lote criado a partir de resposta estruturada do ChatGPT com foto de cupom ou documento fiscal.',
      summary,
      Lines: {
        create: finalLines.map((line) => ({
          id: line.id,
          rowNumber: line.rowNumber,
          status: line.status,
          errorCode: line.errorCode || null,
          errorMessage: line.errorMessage || null,
          rawData: line.rawData,
          movementAt: line.movementAt || null,
          ingredientName: line.ingredientName || '',
          ingredientNameNormalized: line.ingredientNameNormalized || normalizeName(line.ingredientName),
          motivo: line.motivo || null,
          identification: line.identification || null,
          invoiceNumber: line.invoiceNumber || null,
          supplierId: line.supplierId || null,
          supplierName: line.supplierName || null,
          supplierNameNormalized: line.supplierNameNormalized || null,
          supplierCnpj: line.supplierCnpj || null,
          supplierMatchSource: line.supplierMatchSource || null,
          supplierReconciliationStatus: line.supplierReconciliationStatus || 'not_started',
          supplierReconciliationSource: line.supplierReconciliationSource || null,
          supplierReconciliationAt: line.supplierReconciliationAt || null,
          qtyEntry: line.qtyEntry,
          unitEntry: line.unitEntry || null,
          qtyConsumption: line.qtyConsumption,
          unitConsumption: line.unitConsumption || null,
          movementUnit: line.movementUnit || null,
          costAmount: line.costAmount,
          costTotalAmount: line.costTotalAmount,
          observation: line.observation || null,
          sourceFingerprint:
            line.errorCode === 'duplicate_in_batch'
              ? `${line.sourceFingerprint}_dup_${line.rowNumber}`
              : line.sourceFingerprint,
          duplicateOfLineId: line.duplicateOfLineId || null,
          mappedItemId: line.mappedItemId || null,
          mappedItemName: line.mappedItemName || null,
          mappingSource: line.mappingSource || null,
          manualConversionFactor: line.manualConversionFactor || null,
          conversionSource: line.conversionSource || null,
          conversionFactorUsed: line.conversionFactorUsed || null,
          targetUnit: line.targetUnit || null,
          convertedCostAmount: line.convertedCostAmount ?? null,
          metadata: line.metadata || null,
        })),
      },
    },
    select: { id: true },
  });

  return { batchId: batch.id, summary };
}

export async function reconcileStockMovementImportBatchSuppliersFromFile(params: {
  batchId: string;
  fileName?: string | null;
  fileBuffer: Buffer;
}) {
  const db = prismaClient as any;
  const batch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId }, select: { id: true, notes: true } });
  if (!batch) throw new Error('Lote não encontrado');

  const supplierNotes = parseSupplierNotesJson(params.fileBuffer || null);
  if (supplierNotes.length <= 0) {
    throw new Error('JSON sem notas válidas para conciliar');
  }

  const supplierNotesLookup = buildSupplierNotesLookup(supplierNotes);
  const [lines, lookup] = await Promise.all([
    db.stockMovementImportBatchLine.findMany({ where: { batchId: params.batchId }, orderBy: [{ rowNumber: 'asc' }] }),
    loadItemsAndAliases(),
  ]);

  let matched = 0;
  let unmatched = 0;
  let untouched = 0;

  for (const line of lines) {
    if (str(line.supplierReconciliationStatus).toLowerCase() === 'manual') {
      untouched += 1;
      continue;
    }

    const matchedSupplierNote = matchSupplierNoteForLine(
      { invoiceNumber: line.invoiceNumber, movementAt: line.movementAt },
      supplierNotesLookup,
    );

    if (!matchedSupplierNote) {
      if (!lineHasSupplierReconciled(line) && !str(line.supplierName) && !str(line.supplierCnpj)) {
        await db.stockMovementImportBatchLine.update({
          where: { id: line.id },
          data: {
            supplierReconciliationStatus: 'not_started',
            supplierReconciliationSource: null,
            supplierReconciliationAt: null,
          },
        });
      }
      untouched += 1;
      continue;
    }

    const supplier = resolveSupplierFromLookup(matchedSupplierNote, lookup);
    const supplierReconciliation = buildSupplierReconciliationState(supplier);
    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: {
        supplierId: supplier.supplierId || null,
        supplierName: supplier.supplierName || null,
        supplierNameNormalized: supplier.supplierNameNormalized || null,
        supplierCnpj: supplier.supplierCnpj || null,
        supplierMatchSource: supplier.supplierMatchSource || null,
        supplierReconciliationStatus: supplierReconciliation.supplierReconciliationStatus,
        supplierReconciliationSource: supplierReconciliation.supplierReconciliationSource,
        supplierReconciliationAt: supplierReconciliation.supplierReconciliationAt,
        rawData:
          typeof line.rawData === 'object' && line.rawData && !Array.isArray(line.rawData)
            ? {
                ...(line.rawData as Record<string, unknown>),
                supplierNote: matchedSupplierNote.raw || null,
              }
            : line.rawData,
      },
    });

    if (lineHasSupplierReconciled({ ...line, ...supplierReconciliation, supplierId: supplier.supplierId })) {
      matched += 1;
    } else {
      unmatched += 1;
    }
  }

  const notesLabel = str(params.fileName) || 'arquivo informado';
  await db.stockMovementImportBatch.update({
    where: { id: params.batchId },
    data: {
      supplierNotesFileName: notesLabel,
      supplierNotesAttachedAt: new Date(),
      notes: `JSON de notas vinculado: ${notesLabel}`,
    },
  });

  const summary = await recomputeBatchLines(params.batchId);
  return { summary, matched, unmatched, untouched };
}

async function recomputeBatchLines(batchId: string) {
  const db = prismaClient as any;
  await ensureSyntheticInvoiceNumbersForVisionBatch(batchId);
  const [lines, lookup] = await Promise.all([
    db.stockMovementImportBatchLine.findMany({ where: { batchId }, orderBy: [{ rowNumber: 'asc' }] }),
    loadItemsAndAliases(),
  ]);
  const costHintsByItemId = await getCurrentCostHintsByItemIds(lookup.items.map((item: any) => item.id));

  const appliedFingerprints = await markExistingAppliedDuplicates(lines);

  for (const line of lines) {
    if (line.appliedAt) continue;

    let next: any = {
      status: line.status,
      errorCode: line.errorCode,
      errorMessage: line.errorMessage,
      mappedItemId: line.mappedItemId,
      mappedItemName: line.mappedItemName,
      mappingSource: line.mappingSource,
      targetUnit: line.targetUnit,
      convertedCostAmount: line.convertedCostAmount,
      conversionSource: line.conversionSource,
      conversionFactorUsed: line.conversionFactorUsed,
    };

    if (String(line.status) === 'ignored' && String(line.errorCode) === 'ignored_by_user') {
      next = {
        ...next,
        status: 'ignored',
        errorCode: 'ignored_by_user',
        errorMessage: 'Linha ignorada manualmente',
      };
    } else if (String(line.status) === 'skipped_duplicate' && String(line.errorCode) === 'duplicate_in_batch') {
      // Keep file-internal duplicates skipped.
    } else if (appliedFingerprints.has(String(line.sourceFingerprint))) {
      next = {
        ...next,
        status: 'skipped_duplicate',
        errorCode: 'duplicate_already_applied',
        errorMessage: 'Linha já importada em lote anterior',
      };
    } else {
      let working = line;
      if (line.mappedItemId) {
        const item = lookup.itemsById.get(String(line.mappedItemId));
        if (!item) {
          next = {
            ...next,
            status: 'pending_mapping',
            errorCode: 'item_not_found',
            errorMessage: 'Item mapeado não existe mais',
            mappedItemName: null,
          };
        } else {
          const conv = await resolveConversionForLine(line, item);
          const reviewedStatus = resolveReadyStatusWithCostReview({
            line,
            status: conv.status,
            mappedItemId: item.id,
            convertedCostAmount: (conv as any).convertedCostAmount ?? null,
            targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(item),
            costHintsByItemId,
          });
          next = {
            ...next,
            mappedItemName: item.name,
            status: reviewedStatus.status,
            errorCode: conv.status === 'ready' ? reviewedStatus.errorCode : (conv as any).errorCode,
            errorMessage: conv.status === 'ready' ? reviewedStatus.errorMessage : (conv as any).errorMessage,
            targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(item),
            convertedCostAmount: (conv as any).convertedCostAmount ?? null,
            conversionSource: (conv as any).conversionSource ?? null,
            conversionFactorUsed: (conv as any).conversionFactorUsed ?? null,
          };
        }
      } else {
        const auto = chooseAutoMapping(line.ingredientName, lookup);
        if (!auto.item) {
          next = {
            ...next,
            status: 'pending_mapping',
            errorCode: 'item_not_mapped',
            errorMessage: 'Ingrediente não mapeado',
            mappedItemId: null,
            mappedItemName: null,
            mappingSource: null,
            targetUnit: null,
            convertedCostAmount: null,
            conversionSource: null,
            conversionFactorUsed: null,
          };
        } else {
          working = {
            ...working,
            mappedItemId: auto.item.id,
            mappingSource: 'exact',
          };
          const conv = await resolveConversionForLine(working, auto.item);
          const reviewedStatus = resolveReadyStatusWithCostReview({
            line: working,
            status: conv.status,
            mappedItemId: auto.item.id,
            convertedCostAmount: (conv as any).convertedCostAmount ?? null,
            targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(auto.item),
            costHintsByItemId,
          });
          next = {
            ...next,
            mappedItemId: auto.item.id,
            mappedItemName: auto.item.name,
            mappingSource: auto.source,
            status: reviewedStatus.status,
            errorCode: conv.status === 'ready' ? reviewedStatus.errorCode : (conv as any).errorCode,
            errorMessage: conv.status === 'ready' ? reviewedStatus.errorMessage : (conv as any).errorMessage,
            targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(auto.item),
            convertedCostAmount: (conv as any).convertedCostAmount ?? null,
            conversionSource: (conv as any).conversionSource ?? null,
            conversionFactorUsed: (conv as any).conversionFactorUsed ?? null,
          };
        }
      }
    }

    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: next,
    });
  }

  return await refreshBatchSummary(batchId);
}

async function ensureSyntheticInvoiceNumbersForVisionBatch(batchId: string) {
  const db = prismaClient as any;
  const batch = await db.stockMovementImportBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      sourceType: true,
      worksheetName: true,
      originalFileName: true,
      periodStart: true,
      Lines: {
        orderBy: [{ rowNumber: 'asc' }],
        select: {
          id: true,
          rowNumber: true,
          invoiceNumber: true,
          movementAt: true,
          supplierName: true,
          supplierCnpj: true,
          ingredientName: true,
          qtyEntry: true,
          costAmount: true,
          identification: true,
          metadata: true,
        },
      },
    },
  });

  if (!batch) return;
  if (batch.sourceType !== SOURCE_TYPE_VISION) return;

  const linesMissingInvoice = (batch.Lines || []).filter((line: any) => !str(line.invoiceNumber));
  if (linesMissingInvoice.length === 0) return;

  const syntheticInvoiceNumber = buildSyntheticVisionInvoiceNumber({
    movementAt: batch.periodStart || batch.Lines.find((line: any) => line.movementAt)?.movementAt || null,
    supplierName: batch.Lines.find((line: any) => line.supplierName)?.supplierName || null,
    supplierCnpj: batch.Lines.find((line: any) => line.supplierCnpj)?.supplierCnpj || null,
    lines: batch.Lines,
  });

  for (const line of linesMissingInvoice) {
    const metadata = typeof line.metadata === 'object' && line.metadata && !Array.isArray(line.metadata)
      ? { ...(line.metadata as Record<string, unknown>) }
      : {};
    metadata.syntheticInvoiceNumber = syntheticInvoiceNumber;

    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: {
        invoiceNumber: syntheticInvoiceNumber,
        identification: str(line.identification) || `CUPOM: ${syntheticInvoiceNumber}`,
        metadata,
      },
    });
  }
}

export async function refreshBatchSummary(batchId: string) {
  const db = prismaClient as any;
  const lines = await db.stockMovementImportBatchLine.findMany({
    where: { batchId },
    select: {
      status: true,
      invoiceNumber: true,
      supplierId: true,
      supplierReconciliationStatus: true,
    },
  });
  const summary = summarizeLines(lines);

  const batch = await db.stockMovementImportBatch.findUnique({ where: { id: batchId }, select: { appliedAt: true, rolledBackAt: true } });
  let status = derivePreApplyBatchStatus(summary);
  if (batch?.appliedAt && !batch?.rolledBackAt) {
    status =
      summary.readyToImport > 0 ||
      summary.pendingMapping > 0 ||
      summary.pendingSupplier > 0 ||
      summary.pendingConversion > 0 ||
      summary.pendingCostReview > 0 ||
      summary.error > 0
        ? 'partial'
        : 'imported';
  }
  if (batch?.rolledBackAt) {
    status = 'rolled_back';
  }

  await db.stockMovementImportBatch.update({
    where: { id: batchId },
    data: { summary, status },
  });

  return summary;
}

export async function mapBatchLinesToItem(params: {
  batchId: string;
  lineId?: string | null;
  ingredientNameNormalized?: string | null;
  itemId: string;
  applyToAllSameIngredient?: boolean;
  saveAlias?: boolean;
  actor?: string | null;
}) {
  const db = prismaClient as any;
  const item = await db.item.findUnique({
    where: { id: params.itemId },
    select: { id: true, name: true, purchaseUm: true, consumptionUm: true, purchaseToConsumptionFactor: true, active: true, ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } } },
  });
  if (!item) throw new Error('Item não encontrado');
  const costHintsByItemId = await getCurrentCostHintsByItemIds([item.id]);

  const where: any = { batchId: params.batchId };
  if (params.applyToAllSameIngredient && params.ingredientNameNormalized) {
    where.ingredientNameNormalized = params.ingredientNameNormalized;
    where.appliedAt = null;
  } else if (params.lineId) {
    where.id = params.lineId;
  } else {
    throw new Error('Linha inválida para mapear');
  }

  const lines = await db.stockMovementImportBatchLine.findMany({ where });
  for (const line of lines) {
    const conv = await resolveConversionForLine({ ...line, mappedItemId: item.id }, item);
    const reviewedStatus = resolveReadyStatusWithCostReview({
      line: { ...line, mappedItemId: item.id },
      status: conv.status,
      mappedItemId: item.id,
      convertedCostAmount: (conv as any).convertedCostAmount ?? null,
      targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(item),
      costHintsByItemId,
    });
    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: {
        mappedItemId: item.id,
        mappedItemName: item.name,
        mappingSource: 'manual',
        status: reviewedStatus.status,
        errorCode: conv.status === 'ready' ? reviewedStatus.errorCode : (conv as any).errorCode,
        errorMessage: conv.status === 'ready' ? reviewedStatus.errorMessage : (conv as any).errorMessage,
        targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(item),
        convertedCostAmount: (conv as any).convertedCostAmount ?? null,
        conversionSource: (conv as any).conversionSource ?? null,
        conversionFactorUsed: (conv as any).conversionFactorUsed ?? null,
      },
    });
  }

  if (params.saveAlias && params.ingredientNameNormalized) {
    const aliasLine = lines.find((line: any) => line.ingredientNameNormalized === params.ingredientNameNormalized);
    if (aliasLine) {
      await db.itemImportAlias.upsert({
        where: {
          sourceSystem_sourceType_aliasNormalized: {
            sourceSystem: SOURCE_SYSTEM,
            sourceType: ALIAS_SOURCE_TYPE,
            aliasNormalized: aliasLine.ingredientNameNormalized,
          },
        },
        create: {
          sourceSystem: SOURCE_SYSTEM,
          sourceType: ALIAS_SOURCE_TYPE,
          aliasName: aliasLine.ingredientName,
          aliasNormalized: aliasLine.ingredientNameNormalized,
          itemId: item.id,
          active: true,
          createdBy: params.actor || null,
        },
        update: {
          aliasName: aliasLine.ingredientName,
          itemId: item.id,
          active: true,
        },
      });
    }
  }

  await recomputeBatchLines(params.batchId);
}

export async function setBatchLineManualConversion(params: {
  batchId: string;
  lineId: string;
  factor: number;
}) {
  const db = prismaClient as any;
  if (!(params.factor > 0)) throw new Error('Informe um fator maior que zero');
  const line = await db.stockMovementImportBatchLine.findUnique({ where: { id: params.lineId } });
  if (!line || line.batchId !== params.batchId) throw new Error('Linha inválida');

  await db.stockMovementImportBatchLine.update({
    where: { id: params.lineId },
    data: { manualConversionFactor: params.factor },
  });

  await recomputeBatchLines(params.batchId);
}

export async function updateStockMovementImportBatchLineEditableFields(params: {
  batchId: string;
  lineId: string;
  actor?: string | null;
  movementAt?: Date | null;
  ingredientName: string;
  motivo?: string | null;
  identification?: string | null;
  invoiceNumber?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierCnpj?: string | null;
  qtyEntry?: number | null;
  unitEntry?: string | null;
  qtyConsumption?: number | null;
  unitConsumption?: string | null;
  movementUnit?: string | null;
  costAmount?: number | null;
  costTotalAmount?: number | null;
  observation?: string | null;
  mappedItemId?: string | null;
  manualConversionFactor?: number | null;
}) {
  const db = prismaClient as any;
  const line = await db.stockMovementImportBatchLine.findUnique({ where: { id: params.lineId } });
  if (!line || line.batchId !== params.batchId) throw new Error('Linha inválida');
  const activeMovement = await db.stockMovement.findFirst({
    where: {
      importBatchId: params.batchId,
      importLineId: params.lineId,
      deletedAt: null,
    },
    orderBy: [{ appliedAt: 'desc' }],
    select: {
      id: true,
      itemId: true,
      previousCostVariationId: true,
      previousCostAmount: true,
      previousCostUnit: true,
      newCostAmount: true,
      newCostUnit: true,
      movementUnit: true,
      conversionSource: true,
      conversionFactorUsed: true,
      invoiceNumber: true,
      supplierId: true,
      supplierName: true,
      supplierCnpj: true,
      movementAt: true,
      appliedAt: true,
      metadata: true,
    },
  });
  const isActiveMovement = Boolean(activeMovement || (line.appliedAt && !line.rolledBackAt));

  const ingredientName = str(params.ingredientName);
  if (!ingredientName) throw new Error('Ingrediente é obrigatório');

  const parsedCostAmount = params.costAmount == null ? null : Number(params.costAmount);
  if (parsedCostAmount != null && !Number.isFinite(parsedCostAmount)) {
    throw new Error('Custo unitário inválido');
  }

  const parsedCostTotalAmount = params.costTotalAmount == null ? null : Number(params.costTotalAmount);
  if (parsedCostTotalAmount != null && !Number.isFinite(parsedCostTotalAmount)) {
    throw new Error('Custo total inválido');
  }

  const parsedQtyEntry = params.qtyEntry == null ? null : Number(params.qtyEntry);
  if (parsedQtyEntry != null && !Number.isFinite(parsedQtyEntry)) {
    throw new Error('Quantidade de entrada inválida');
  }

  const parsedQtyConsumption = params.qtyConsumption == null ? null : Number(params.qtyConsumption);
  if (parsedQtyConsumption != null && !Number.isFinite(parsedQtyConsumption)) {
    throw new Error('Quantidade de consumo inválida');
  }

  const parsedManualConversionFactor =
    params.manualConversionFactor == null || params.manualConversionFactor === 0
      ? null
      : Number(params.manualConversionFactor);
  if (parsedManualConversionFactor != null && (!(Number.isFinite(parsedManualConversionFactor)) || parsedManualConversionFactor <= 0)) {
    throw new Error('Fator manual inválido');
  }

  let mappedItemId = str(params.mappedItemId) || null;
  let mappedItemName: string | null = null;
  if (mappedItemId) {
    const mappedItem = await db.item.findUnique({
      where: { id: mappedItemId },
      select: { id: true, name: true },
    });
    if (!mappedItem) throw new Error('Item selecionado não encontrado');
    mappedItemId = mappedItem.id;
    mappedItemName = mappedItem.name;
  }

  if (isActiveMovement && mappedItemId && String(mappedItemId) !== String(line.mappedItemId || '')) {
    throw new Error('Não é possível trocar o item porque esta movimentação já foi lançada no estoque e ainda não foi revertida. Reverta a linha para remapear o item.');
  }

  let supplierId = str(params.supplierId) || null;
  let supplierName = str(params.supplierName) || null;
  let supplierCnpj = str(params.supplierCnpj) || null;
  let supplierMatchSource: string | null = null;

  if (supplierId) {
    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true, cnpj: true },
    });
    if (!supplier) throw new Error('Fornecedor selecionado não encontrado');
    supplierId = supplier.id;
    supplierName = supplier.name || supplierName;
    supplierCnpj = supplier.cnpj || supplierCnpj;
    supplierMatchSource = 'manual_selected_supplier';
  } else if (supplierName || supplierCnpj) {
    supplierMatchSource = 'manual_edited_supplier';
  }

  const supplierReconciliation = buildSupplierReconciliationState({
    supplierId,
    supplierName,
    supplierCnpj,
    supplierMatchSource,
    manual: Boolean(supplierId),
  });

  const previousMetadata =
    typeof line.metadata === 'object' && line.metadata && !Array.isArray(line.metadata)
      ? { ...(line.metadata as Record<string, unknown>) }
      : {};
  const previousEditHistory = Array.isArray(previousMetadata.editHistory) ? [...(previousMetadata.editHistory as any[])] : [];
  const editEntry = {
    editedAt: new Date().toISOString(),
    editedBy: str(params.actor) || null,
    mode: isActiveMovement ? 'active_movement_edit' : 'pre_import_edit',
    previousSnapshot: {
      movementAt: line.movementAt,
      ingredientName: line.ingredientName,
      motivo: line.motivo,
      identification: line.identification,
      invoiceNumber: line.invoiceNumber,
      supplierId: line.supplierId,
      supplierName: line.supplierName,
      supplierCnpj: line.supplierCnpj,
      qtyEntry: line.qtyEntry,
      unitEntry: line.unitEntry,
      qtyConsumption: line.qtyConsumption,
      unitConsumption: line.unitConsumption,
      movementUnit: line.movementUnit,
      costAmount: line.costAmount,
      costTotalAmount: line.costTotalAmount,
      observation: line.observation,
      mappedItemId: line.mappedItemId,
      mappedItemName: line.mappedItemName,
      manualConversionFactor: line.manualConversionFactor,
      convertedCostAmount: line.convertedCostAmount,
      targetUnit: line.targetUnit,
      conversionSource: line.conversionSource,
      conversionFactorUsed: line.conversionFactorUsed,
      status: line.status,
    },
  };
  const nextMetadata = {
    ...previousMetadata,
    lastEditedAt: editEntry.editedAt,
    lastEditedBy: editEntry.editedBy,
    editHistory: [...previousEditHistory, editEntry],
  };

  const nextMovementAt = params.movementAt || null;
  const nextLineDraft = {
    ...line,
    movementAt: nextMovementAt,
    ingredientName,
    ingredientNameNormalized: normalizeName(ingredientName),
    motivo: str(params.motivo) || null,
    identification: str(params.identification) || null,
    invoiceNumber: str(params.invoiceNumber) || null,
    supplierId,
    supplierName,
    supplierCnpj,
    qtyEntry: parsedQtyEntry,
    unitEntry: str(params.unitEntry).toUpperCase() || null,
    qtyConsumption: parsedQtyConsumption,
    unitConsumption: str(params.unitConsumption).toUpperCase() || null,
    movementUnit: str(params.movementUnit).toUpperCase() || null,
    costAmount: parsedCostAmount,
    costTotalAmount: parsedCostTotalAmount,
    observation: str(params.observation) || null,
    mappedItemId: mappedItemId ?? line.mappedItemId ?? null,
    mappedItemName: mappedItemName ?? line.mappedItemName ?? null,
    mappingSource: (mappedItemId ?? line.mappedItemId) ? 'manual' : null,
    manualConversionFactor: parsedManualConversionFactor,
    supplierMatchSource,
  };

  if (isActiveMovement) {
    const activeMappedItemId = String(nextLineDraft.mappedItemId || '').trim();
    if (!activeMappedItemId) {
      throw new Error('A movimentação já lançada no estoque precisa continuar com um item mapeado.');
    }

    const activeItem = await db.item.findUnique({
      where: { id: activeMappedItemId },
      select: {
        id: true,
        name: true,
        purchaseUm: true,
        consumptionUm: true,
        purchaseToConsumptionFactor: true,
        ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
      },
    });
    if (!activeItem) throw new Error('O item mapeado da movimentação já lançada no estoque não foi encontrado');

    const conversion = await resolveConversionForLine(nextLineDraft, activeItem);
    if (conversion.status !== 'ready') {
      throw new Error('A movimentação já lançada no estoque precisa continuar com conversão válida após a edição.');
    }

    await db.stockMovementImportBatchLine.update({
      where: { id: params.lineId },
      data: {
        movementAt: nextMovementAt,
        ingredientName,
        ingredientNameNormalized: normalizeName(ingredientName),
        motivo: str(params.motivo) || null,
        identification: str(params.identification) || null,
        invoiceNumber: str(params.invoiceNumber) || null,
        supplierId,
        supplierName,
        supplierNameNormalized: supplierName ? normalizeName(supplierName) : null,
        supplierCnpj,
        supplierMatchSource,
        supplierReconciliationStatus: supplierReconciliation.supplierReconciliationStatus,
        supplierReconciliationSource: supplierReconciliation.supplierReconciliationSource,
        supplierReconciliationAt: supplierReconciliation.supplierReconciliationAt,
        qtyEntry: parsedQtyEntry,
        unitEntry: str(params.unitEntry).toUpperCase() || null,
        qtyConsumption: parsedQtyConsumption,
        unitConsumption: str(params.unitConsumption).toUpperCase() || null,
        movementUnit: str(params.movementUnit).toUpperCase() || null,
        costAmount: parsedCostAmount,
        costTotalAmount: parsedCostTotalAmount,
        observation: str(params.observation) || null,
        mappedItemId: activeItem.id,
        mappedItemName: activeItem.name,
        mappingSource: 'manual',
        manualConversionFactor: parsedManualConversionFactor,
        targetUnit: (conversion as any).targetUnit ?? resolveTargetUnit(activeItem),
        convertedCostAmount: (conversion as any).convertedCostAmount ?? null,
        conversionSource: (conversion as any).conversionSource ?? null,
        conversionFactorUsed: (conversion as any).conversionFactorUsed ?? null,
        status: 'imported',
        errorCode: null,
        errorMessage: null,
        metadata: nextMetadata,
      },
    });

    if (activeMovement) {
      const movementPreviousMetadata =
        typeof activeMovement.metadata === 'object' && activeMovement.metadata && !Array.isArray(activeMovement.metadata)
          ? { ...(activeMovement.metadata as Record<string, unknown>) }
          : {};
      const movementEditHistory = Array.isArray(movementPreviousMetadata.editHistory)
        ? [...(movementPreviousMetadata.editHistory as any[])]
        : [];

      await db.stockMovement.update({
        where: { id: activeMovement.id },
        data: {
        direction: 'entry',
        movementType: 'import',
        itemId: activeItem.id,
        quantityAmount: parsedQtyEntry ?? parsedQtyConsumption ?? activeMovement.quantityAmount ?? null,
        quantityUnit:
          str(params.unitEntry).toUpperCase() ||
          str(params.unitConsumption).toUpperCase() ||
          str(params.movementUnit).toUpperCase() ||
          activeMovement.quantityUnit ||
          null,
        newCostAmount: Number((conversion as any).convertedCostAmount ?? activeMovement.newCostAmount),
        newCostUnit: (conversion as any).targetUnit ?? activeMovement.newCostUnit,
        previousCostVariationId: activeMovement.previousCostVariationId || null,
        previousCostAmount: activeMovement.previousCostAmount ?? null,
        previousCostUnit: activeMovement.previousCostUnit ?? null,
        movementUnit: str(params.movementUnit).toUpperCase() || null,
        conversionSource: (conversion as any).conversionSource ?? null,
        conversionFactorUsed: (conversion as any).conversionFactorUsed ?? null,
        invoiceNumber: str(params.invoiceNumber) || null,
        supplierId,
        supplierName,
        supplierCnpj,
        movementAt: nextMovementAt,
        metadata: {
          ...movementPreviousMetadata,
          ...movementMetadataBase({
            batchId: params.batchId,
            lineId: params.lineId,
            line: {
              ...nextLineDraft,
              mappedItemId: activeItem.id,
              mappedItemName: activeItem.name,
              targetUnit: (conversion as any).targetUnit ?? resolveTargetUnit(activeItem),
              convertedCostAmount: (conversion as any).convertedCostAmount ?? null,
              conversionSource: (conversion as any).conversionSource ?? null,
              conversionFactorUsed: (conversion as any).conversionFactorUsed ?? null,
            },
            sourceAction: 'manual_edit_on_active_import_movement',
          }),
          originType: 'import-line',
          originRefId: params.lineId,
          editHistory: [...movementEditHistory, editEntry],
          editedActiveMovement: true,
        },
        },
      });
    }

    // Cost history is only written when there is a concrete StockMovement to
    // reference. Without an active movement the edit is a data-only change on
    // the import line and must not produce a history entry with a line-level
    // reference (stock-movement-import-line is not a valid referenceType).
    if (activeMovement) {
      const baseVar = await itemVariationPrismaEntity.findPrimaryVariationForItem(activeItem.id, {
        ensureBaseIfMissing: true,
      });
      if (baseVar?.id) {
        const currentCost = await db.itemCostVariation.findUnique({ where: { itemVariationId: baseVar.id } });
        const currentRefMatchesMovement =
          str(currentCost?.referenceType) === COST_REFERENCE_TYPE_MOVEMENT &&
          str(currentCost?.referenceId) === activeMovement.id;
        const costHistoryMetadata = {
          ...(typeof nextMetadata === 'object' ? nextMetadata : {}),
          sourceAction: 'manual_edit_on_active_import_movement',
          importBatchId: params.batchId,
          importLineId: params.lineId,
          stockMovementId: activeMovement.id,
        };

        if (currentRefMatchesMovement) {
          await itemCostVariationPrismaEntity.setCurrentCost({
            itemVariationId: baseVar.id,
            costAmount: Number((conversion as any).convertedCostAmount ?? 0),
            unit: (conversion as any).targetUnit ?? null,
            source: 'adjustment',
            referenceType: COST_REFERENCE_TYPE_MOVEMENT,
            referenceId: activeMovement.id,
            validFrom: nextMovementAt || new Date(),
            updatedBy: str(params.actor) || null,
            metadata: costHistoryMetadata,
          });
        } else {
          await itemCostVariationPrismaEntity.addHistoryEntry({
            itemVariationId: baseVar.id,
            costAmount: Number((conversion as any).convertedCostAmount ?? 0),
            unit: (conversion as any).targetUnit ?? null,
            source: 'adjustment',
            referenceType: COST_REFERENCE_TYPE_MOVEMENT,
            referenceId: activeMovement.id,
            validFrom: nextMovementAt || new Date(),
            updatedBy: str(params.actor) || null,
            metadata: costHistoryMetadata,
          });
        }
      }
    }

    await refreshBatchSummary(params.batchId);
    return;
  }

  await db.stockMovementImportBatchLine.update({
    where: { id: params.lineId },
    data: {
      movementAt: params.movementAt || null,
      ingredientName,
      ingredientNameNormalized: normalizeName(ingredientName),
      motivo: str(params.motivo) || null,
      identification: str(params.identification) || null,
      invoiceNumber: str(params.invoiceNumber) || null,
      supplierId,
      supplierName,
      supplierNameNormalized: supplierName ? normalizeName(supplierName) : null,
      supplierCnpj,
      supplierMatchSource,
      supplierReconciliationStatus: supplierReconciliation.supplierReconciliationStatus,
      supplierReconciliationSource: supplierReconciliation.supplierReconciliationSource,
      supplierReconciliationAt: supplierReconciliation.supplierReconciliationAt,
      qtyEntry: parsedQtyEntry,
      unitEntry: str(params.unitEntry).toUpperCase() || null,
      qtyConsumption: parsedQtyConsumption,
      unitConsumption: str(params.unitConsumption).toUpperCase() || null,
      movementUnit: str(params.movementUnit).toUpperCase() || null,
      costAmount: parsedCostAmount,
      costTotalAmount: parsedCostTotalAmount,
      observation: str(params.observation) || null,
      mappedItemId,
      mappedItemName,
      mappingSource: mappedItemId ? 'manual' : null,
      manualConversionFactor: parsedManualConversionFactor,
      status: 'draft',
      errorCode: null,
      errorMessage: null,
      metadata: nextMetadata,
    },
  });

  await recomputeBatchLines(params.batchId);
}

export async function setBatchLineIgnored(params: {
  batchId: string;
  lineId: string;
  ignored: boolean;
}) {
  const db = prismaClient as any;
  const line = await db.stockMovementImportBatchLine.findUnique({ where: { id: params.lineId } });
  if (!line || line.batchId !== params.batchId) throw new Error('Linha inválida');
  const activeMovement = await db.stockMovement.findFirst({
    where: {
      importBatchId: params.batchId,
      importLineId: params.lineId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (line.appliedAt && activeMovement) throw new Error('Linha já importada não pode ser ignorada');

  if (params.ignored) {
    await db.stockMovementImportBatchLine.update({
      where: { id: params.lineId },
      data: {
        appliedAt: activeMovement ? line.appliedAt : null,
        rolledBackAt: activeMovement ? line.rolledBackAt : (line.rolledBackAt || new Date()),
        status: 'ignored',
        errorCode: 'ignored_by_user',
        errorMessage: 'Linha ignorada manualmente',
      },
    });
    await refreshBatchSummary(params.batchId);
    return;
  }

  await db.stockMovementImportBatchLine.update({
    where: { id: params.lineId },
    data: {
      status: 'draft',
      errorCode: null,
      errorMessage: null,
    },
  });

  await recomputeBatchLines(params.batchId);
}

export async function retryStockMovementImportBatchErrors(params: {
  batchId: string;
  lineId?: string | null;
}) {
  const db = prismaClient as any;
  const where: Record<string, unknown> = {
    batchId: params.batchId,
    appliedAt: null,
    status: 'error',
  };

  if (params.lineId) where.id = params.lineId;

  const lines = await db.stockMovementImportBatchLine.findMany({
    where,
    select: { id: true },
  });

  if (params.lineId && lines.length <= 0) {
    throw new Error('Linha não está em erro para retentativa');
  }

  if (lines.length <= 0) {
    return { retriedCount: 0, summary: await refreshBatchSummary(params.batchId) };
  }

  await db.stockMovementImportBatchLine.updateMany({
    where: {
      id: { in: lines.map((line: { id: string }) => line.id) },
    },
    data: {
      status: 'draft',
      errorCode: null,
      errorMessage: null,
    },
  });

  const summary = await recomputeBatchLines(params.batchId);
  return { retriedCount: lines.length, summary };
}

export async function approveBatchLineCostReview(params: {
  batchId: string;
  lineId: string;
  actor?: string | null;
}) {
  const db = prismaClient as any;
  const line = await db.stockMovementImportBatchLine.findUnique({ where: { id: params.lineId } });
  if (!line || line.batchId !== params.batchId) throw new Error('Linha inválida');
  if (line.appliedAt) throw new Error('Linha já importada não pode ser reclassificada');
  if (str(line.status) !== 'pending_cost_review') throw new Error('Linha não está pendente de revisão de custo');

  const metadata =
    typeof line.metadata === 'object' && line.metadata && !Array.isArray(line.metadata)
      ? { ...(line.metadata as Record<string, unknown>) }
      : {};
  metadata.costReviewApproval = {
    approvedAt: new Date().toISOString(),
    approvedBy: str(params.actor) || null,
    mappedItemId: line.mappedItemId || null,
    movementUnit: line.movementUnit || null,
    targetUnit: line.targetUnit || null,
    costAmount: line.costAmount ?? null,
    convertedCostAmount: line.convertedCostAmount ?? null,
    manualConversionFactor: line.manualConversionFactor ?? null,
  };

  await db.stockMovementImportBatchLine.update({
    where: { id: params.lineId },
    data: {
      metadata,
      status: 'draft',
      errorCode: null,
      errorMessage: null,
    },
  });

  await recomputeBatchLines(params.batchId);
}

async function getBatchReadyLines(batchId: string) {
  const db = prismaClient as any;
  return await db.stockMovementImportBatchLine.findMany({
    where: { batchId, status: 'ready', appliedAt: null },
    orderBy: [{ rowNumber: 'asc' }],
  });
}

async function importSingleStockMovementImportBatchLine(params: { batchId: string; actor?: string | null; line: any }) {
  const db = prismaClient as any;
  const line = params.line;

  if (await hasActiveAppliedFingerprint(line.sourceFingerprint)) {
    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: {
        status: 'skipped_duplicate',
        errorCode: 'duplicate_already_applied',
        errorMessage: 'Linha já importada em outro lote',
      },
    });
    return { imported: 0, errors: 0, processed: 1 };
  }

  if (!lineHasSupplierReconciled(line)) {
    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: {
        status: 'error',
        errorCode: 'supplier_not_reconciled_import',
        errorMessage: 'Fornecedor do documento ainda não foi conciliado para aplicação',
      },
    });
    return { imported: 0, errors: 1, processed: 1 };
  }

  const item = await db.item.findUnique({
    where: { id: line.mappedItemId },
    select: { id: true, name: true },
  });
  if (!item) {
    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: { status: 'error', errorCode: 'item_missing_import', errorMessage: 'Item não encontrado na aplicação' },
    });
    return { imported: 0, errors: 1, processed: 1 };
  }

  const baseVar = await itemVariationPrismaEntity.findPrimaryVariationForItem(item.id, {
    ensureBaseIfMissing: true,
  });
  if (!baseVar?.id) {
    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: { status: 'error', errorCode: 'item_variation_missing_import', errorMessage: 'Nenhuma variação disponível para aplicar o custo' },
    });
    return { imported: 0, errors: 1, processed: 1 };
  }

  const nextCost = Number(line.convertedCostAmount ?? NaN);
  if (!(nextCost > 0)) {
    await db.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: { status: 'error', errorCode: 'invalid_converted_cost', errorMessage: 'Custo convertido inválido' },
    });
    return { imported: 0, errors: 1, processed: 1 };
  }

  await db.$transaction(async (tx: any) => {
    const currentCost = await tx.itemCostVariation.findUnique({
      where: { itemVariationId: baseVar.id },
    });

    const movement = await tx.stockMovement.create({
      data: {
        direction: 'entry',
        movementType: 'import',
        originType: 'import-line',
        originRefId: line.id,
        importBatchId: params.batchId,
        importLineId: line.id,
        itemId: item.id,
        itemVariationId: baseVar.id,
        supplierId: line.supplierId || null,
        quantityAmount: line.qtyEntry ?? line.qtyConsumption ?? null,
        quantityUnit: line.unitEntry || line.unitConsumption || line.movementUnit || null,
        previousCostVariationId: currentCost?.id || null,
        previousCostAmount: currentCost?.costAmount ?? null,
        previousCostUnit: currentCost?.unit ?? null,
        newCostAmount: nextCost,
        newCostUnit: line.targetUnit || line.movementUnit || null,
        movementUnit: line.movementUnit || null,
        conversionSource: line.conversionSource || null,
        conversionFactorUsed: line.conversionFactorUsed ?? null,
        invoiceNumber: line.invoiceNumber || null,
        supplierName: line.supplierName || null,
        supplierCnpj: line.supplierCnpj || null,
        movementAt: line.movementAt || null,
        appliedBy: params.actor || null,
        metadata: {
          ...movementMetadataBase({
            batchId: params.batchId,
            lineId: line.id,
            line,
          }),
          originType: 'import-line',
          originRefId: line.id,
        },
      },
    });

    await itemCostVariationPrismaEntity.setCurrentCostWithClient(tx, {
      itemVariationId: baseVar.id,
      costAmount: nextCost,
      unit: line.targetUnit || line.movementUnit || null,
      source: 'import',
      referenceType: COST_REFERENCE_TYPE_MOVEMENT,
      referenceId: movement.id,
      validFrom: line.movementAt || new Date(),
      updatedBy: params.actor || null,
      metadata: {
        ...movementMetadataBase({
          batchId: params.batchId,
          lineId: line.id,
          line,
        }),
        stockMovementId: movement.id,
      },
    });

    await tx.stockMovementImportBatchLine.update({
      where: { id: line.id },
      data: {
        status: 'imported',
        appliedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
  });
  return { imported: 1, errors: 0, processed: 1 };
}

export async function importStockMovementImportBatchLine(params: { batchId: string; lineId: string; actor?: string | null }) {
  const db = prismaClient as any;
  const line = await db.stockMovementImportBatchLine.findUnique({
    where: { id: params.lineId },
  });
  if (!line || line.batchId !== params.batchId) throw new Error('Linha inválida');
  if (line.appliedAt) return { imported: 0, errors: 0, processed: 0, skipped: true, reason: 'already_applied' as const };
  if (String(line.status || '') !== 'ready') {
    return { imported: 0, errors: 0, processed: 0, skipped: true, reason: 'not_ready' as const };
  }

  const result = await importSingleStockMovementImportBatchLine({
    batchId: params.batchId,
    actor: params.actor,
    line,
  });
  const summary = await refreshBatchSummary(params.batchId);
  return { ...result, skipped: false, reason: null, summary };
}

function batchImportProgressFromBatch(batch: any, summary?: BatchSummary | null): BatchImportProgress {
  return {
    status: (String(batch?.importStatus || 'idle') as BatchImportProgress['status']),
    processedCount: Number(batch?.importProcessedCount || 0),
    errorCount: Number(batch?.importErrorCount || 0),
    totalCount: Number(batch?.importTotalCount || 0),
    remainingCount: Math.max(0, Number(summary?.readyToImport ?? 0)),
    message: batch?.importMessage ? String(batch.importMessage) : null,
    startedAt: batch?.importStartedAt || null,
    finishedAt: batch?.importFinishedAt || null,
  };
}

export async function startStockMovementImportBatch(params: { batchId: string; actor?: string | null }) {
  const db = prismaClient as any;
  const batch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId } });
  if (!batch) throw new Error('Lote não encontrado');
  if (batch.rolledBackAt) throw new Error('Lote já foi revertido');
  if (String(batch.importStatus || 'idle') === 'importing') {
    const summary = await refreshBatchSummary(params.batchId);
    return batchImportProgressFromBatch(batch, summary);
  }

  await recomputeBatchLines(params.batchId);
  const readyLines = await getBatchReadyLines(params.batchId);
  const startedAt = new Date();

  if (readyLines.length <= 0) {
    await db.stockMovementImportBatch.update({
      where: { id: params.batchId },
      data: {
        importStatus: 'imported',
        importStartedAt: startedAt,
        importFinishedAt: startedAt,
        importProcessedCount: 0,
        importErrorCount: 0,
        importTotalCount: 0,
        importMessage: 'Nenhuma linha pronta para importar.',
      },
    });
    const refreshedBatch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId } });
    const summary = await refreshBatchSummary(params.batchId);
    return batchImportProgressFromBatch(refreshedBatch, summary);
  }

  await db.stockMovementImportBatch.update({
    where: { id: params.batchId },
    data: {
      importStatus: 'importing',
      importStartedAt: startedAt,
      importFinishedAt: null,
      importProcessedCount: 0,
      importErrorCount: 0,
      importTotalCount: readyLines.length,
      importMessage: `Importando ${readyLines.length} linha(s) conciliada(s)...`,
    },
  });

  const refreshedBatch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId } });
  const summary = await refreshBatchSummary(params.batchId);
  return batchImportProgressFromBatch(refreshedBatch, summary);
}

export async function importStockMovementImportBatchStep(params: { batchId: string; actor?: string | null; limit?: number }) {
  const db = prismaClient as any;
  const batch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId } });
  if (!batch) throw new Error('Lote não encontrado');
  if (batch.rolledBackAt) throw new Error('Lote já foi revertido');

  if (String(batch.importStatus || 'idle') !== 'importing') {
    const summary = await refreshBatchSummary(params.batchId);
    return {
      done: String(batch.importStatus || 'idle') !== 'importing',
      progress: batchImportProgressFromBatch(batch, summary),
      summary,
    };
  }

  const limit = Math.max(1, Math.min(25, Math.floor(Number(params.limit || 5))));
  const readyLines = (await getBatchReadyLines(params.batchId)).slice(0, limit);

  if (readyLines.length <= 0) {
    await db.stockMovementImportBatch.update({
      where: { id: params.batchId },
      data: {
        importStatus: 'imported',
        importFinishedAt: new Date(),
        importMessage: 'Importação concluída.',
        appliedAt: new Date(),
      },
    });
    const refreshedBatch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId } });
    const summary = await refreshBatchSummary(params.batchId);
    return { done: true, progress: batchImportProgressFromBatch(refreshedBatch, summary), summary };
  }

  let imported = 0;
  let errors = 0;
  let processed = 0;

  for (const line of readyLines) {
    try {
      const result = await importSingleStockMovementImportBatchLine({ batchId: params.batchId, actor: params.actor, line });
      imported += result.imported;
      errors += result.errors;
      processed += result.processed;
    } catch (error) {
      await db.stockMovementImportBatchLine.update({
        where: { id: line.id },
        data: {
          status: 'error',
          errorCode: 'import_error',
          errorMessage: error instanceof Error ? error.message : 'Erro ao importar linha',
        },
      });
      processed += 1;
      errors += 1;
    }
  }

  await db.stockMovementImportBatch.update({
    where: { id: params.batchId },
    data: {
      importProcessedCount: { increment: processed },
      importErrorCount: { increment: errors },
      importMessage: imported > 0 || errors > 0
        ? `Processadas ${processed} linha(s) nesta etapa.`
        : 'Etapa concluída sem alterações.',
    },
  });

  const summary = await refreshBatchSummary(params.batchId);
  const remainingReadyLines = await getBatchReadyLines(params.batchId);
  const done = remainingReadyLines.length <= 0;

  if (done) {
    await db.stockMovementImportBatch.update({
      where: { id: params.batchId },
      data: {
        importStatus: 'imported',
        importFinishedAt: new Date(),
        importMessage: errors > 0
          ? 'Importação concluída com algumas linhas em erro.'
          : 'Importação concluída.',
        appliedAt: new Date(),
      },
    });
  }

  const refreshedBatch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId } });

  return {
    done,
    imported,
    errors,
    processed,
    progress: batchImportProgressFromBatch(refreshedBatch, summary),
    summary,
  };
}

export async function importStockMovementImportBatch(params: { batchId: string; actor?: string | null }) {
  await startStockMovementImportBatch(params);
  let lastStep = await importStockMovementImportBatchStep({ ...params, limit: 5 });
  while (!lastStep.done) {
    lastStep = await importStockMovementImportBatchStep({ ...params, limit: 5 });
  }
  const summary = await refreshBatchSummary(params.batchId);

  return {
    imported: Number(lastStep.progress.processedCount || 0) - Number(lastStep.progress.errorCount || 0),
    errors: Number(lastStep.progress.errorCount || 0),
    summary,
  };
}

export async function rollbackStockMovementImportBatch(params: { batchId: string; actor?: string | null }) {
  const db = prismaClient as any;
  const batch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId } });
  if (!batch) throw new Error('Lote não encontrado');
  const movements = await db.stockMovement.findMany({
    where: { importBatchId: params.batchId, deletedAt: null },
    orderBy: [{ appliedAt: 'desc' }],
    select: {
      id: true,
      importLineId: true,
      itemVariationId: true,
      previousCostAmount: true,
      previousCostUnit: true,
      metadata: true,
    },
  });

  const result = await deleteImportedStockMovements({
    batchId: params.batchId,
    actor: params.actor,
    movements,
  });

  await updateBatchRollbackState(params.batchId, { forceRolledBackAt: true });
  const summary = await refreshBatchSummary(params.batchId);

  return { ...result, summary };
}

async function deleteImportedStockMovements(params: {
  batchId: string;
  actor?: string | null;
  movements: any[];
  allowDeleteWithoutCostRollback?: boolean;
}) {
  const db = prismaClient as any;
  let deleted = 0;
  let conflicts = 0;
  let errors = 0;
  let deletedWithoutCostRollback = 0;

  for (const movement of params.movements || []) {
    try {
      const current = await db.itemCostVariation.findUnique({ where: { itemVariationId: movement.itemVariationId } });
      const currentRefType = str(current?.referenceType);
      const currentRefId = str(current?.referenceId);
      const matchesMovementRef = currentRefType === COST_REFERENCE_TYPE_MOVEMENT && currentRefId === str(movement.id);
      const matchesLegacyLineRef = currentRefType === COST_REFERENCE_TYPE_LINE && currentRefId === str(movement.importLineId);
      const canRestorePreviousCost = Boolean(current && (matchesMovementRef || matchesLegacyLineRef));

      if (!current && !params.allowDeleteWithoutCostRollback) {
        conflicts += 1;
        continue;
      }
      if (!canRestorePreviousCost && !params.allowDeleteWithoutCostRollback) {
        conflicts += 1;
        continue;
      }

      const previousAmount = Number(movement.previousCostAmount ?? NaN);
      if (canRestorePreviousCost && Number.isFinite(previousAmount) && previousAmount >= 0) {
        await itemCostVariationPrismaEntity.setCurrentCost({
          itemVariationId: movement.itemVariationId,
          costAmount: previousAmount,
          unit: movement.previousCostUnit || null,
          source: 'import',
          referenceType: 'stock-movement-delete',
          referenceId: movement.id,
          validFrom: new Date(),
          updatedBy: params.actor || null,
          metadata: {
            importBatchId: params.batchId,
            importLineId: movement.importLineId,
            deletedStockMovementId: movement.id,
            action: 'delete_imported_stock_movement',
            hideFromItemHistory: true,
            hideFromGlobalCostHistory: true,
          },
        });
      }

      if (canRestorePreviousCost) {
        const rollbackHistoryEntry = await db.itemCostVariationHistory.findFirst({
          where: {
            itemVariationId: movement.itemVariationId,
            referenceType: 'stock-movement-delete',
            referenceId: movement.id,
          },
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            validFrom: true,
          },
        });

        if (rollbackHistoryEntry) {
          await db.itemCostVariationHistoryAudit.create({
            data: {
              historyRecordId: rollbackHistoryEntry.id,
              itemVariationId: movement.itemVariationId,
              costAmountBefore: Number(current?.costAmount || 0),
              costAmountAfter: previousAmount,
              unitBefore: current?.unit ?? null,
              unitAfter: movement.previousCostUnit || null,
              sourceBefore: current?.source ?? null,
              sourceAfter: 'import',
              validFromBefore: current?.validFrom || rollbackHistoryEntry.validFrom,
              validFromAfter: rollbackHistoryEntry.validFrom,
              changedBy: params.actor || null,
              changeReason: 'import_rollback',
              metadata: {
                importBatchId: params.batchId,
                importLineId: movement.importLineId,
                deletedStockMovementId: movement.id,
                action: 'delete_imported_stock_movement',
              },
            },
          });
        }
      }

      const linkedHistoryEntries = await db.itemCostVariationHistory.findMany({
        where: {
          itemVariationId: movement.itemVariationId,
          referenceType: COST_REFERENCE_TYPE_MOVEMENT,
          referenceId: movement.id,
        },
        select: {
          id: true,
          metadata: true,
        },
      });

      for (const historyEntry of linkedHistoryEntries as any[]) {
        const previousMetadata =
          typeof historyEntry.metadata === 'object' && historyEntry.metadata && !Array.isArray(historyEntry.metadata)
            ? { ...(historyEntry.metadata as Record<string, unknown>) }
            : {};
        await db.itemCostVariationHistory.update({
          where: { id: historyEntry.id },
          data: {
            metadata: {
              ...previousMetadata,
              excludeFromMetrics: true,
              hideFromItemHistory: true,
              rolledBackAt: new Date().toISOString(),
              rolledBackBy: params.actor || null,
              rolledBackBecause: 'import_movement_deleted',
              deletedStockMovementId: movement.id,
              importBatchId: params.batchId,
              importLineId: movement.importLineId,
              deletedWithoutCostRollback: !canRestorePreviousCost,
            },
          },
        });
      }

      const movementMetadata =
        typeof movement.metadata === 'object' && movement.metadata && !Array.isArray(movement.metadata)
          ? { ...(movement.metadata as Record<string, unknown>) }
          : {};
      const deletionHistory = Array.isArray(movementMetadata.deletionHistory) ? [...(movementMetadata.deletionHistory as any[])] : [];
      const deletedAt = new Date();
      await db.stockMovement.update({
        where: { id: movement.id },
        data: {
          deletedAt,
          metadata: {
            ...movementMetadata,
            deletedAt: deletedAt.toISOString(),
            deletedBy: params.actor || null,
            deletedReason: 'import_removed',
            deletedWithoutCostRollback: !canRestorePreviousCost,
            deletionHistory: [
              ...deletionHistory,
              {
                deletedAt: deletedAt.toISOString(),
                deletedBy: params.actor || null,
                reason: 'import_removed',
                deletedWithoutCostRollback: !canRestorePreviousCost,
                importBatchId: params.batchId,
                importLineId: movement.importLineId,
                stockMovementId: movement.id,
              },
            ],
          },
        },
      });

      await db.stockMovementImportBatchLine.update({
        where: { id: movement.importLineId },
        data: {
          rolledBackAt: new Date(),
          status: 'ready',
          appliedAt: null,
        },
      });
      if (!canRestorePreviousCost) deletedWithoutCostRollback += 1;
      deleted += 1;
    } catch (error) {
      errors += 1;
    }
  }

  return { deleted, conflicts, errors, deletedWithoutCostRollback };
}

async function updateBatchRollbackState(batchId: string, options?: { forceRolledBackAt?: boolean }) {
  const db = prismaClient as any;
  const activeMovements = await db.stockMovement.count({
    where: { importBatchId: batchId, deletedAt: null },
  });
  const hasActiveMovements = activeMovements > 0;

  await db.stockMovementImportBatch.update({
    where: { id: batchId },
    data: {
      rolledBackAt: options?.forceRolledBackAt ? new Date() : hasActiveMovements ? null : new Date(),
      status: hasActiveMovements ? 'partial' : 'rolled_back',
    },
  });
}

export async function rollbackStockMovementImportBatchLine(params: {
  batchId: string;
  lineId: string;
  actor?: string | null;
  allowDeleteWithoutCostRollback?: boolean;
}) {
  const db = prismaClient as any;
  const batch = await db.stockMovementImportBatch.findUnique({ where: { id: params.batchId } });
  if (!batch) throw new Error('Lote não encontrado');

  const movement = await db.stockMovement.findFirst({
    where: {
      importBatchId: params.batchId,
      importLineId: params.lineId,
      deletedAt: null,
    },
    orderBy: [{ appliedAt: 'desc' }],
    select: {
      id: true,
      importLineId: true,
      itemVariationId: true,
      previousCostAmount: true,
      previousCostUnit: true,
      metadata: true,
    },
  });
  if (!movement) throw new Error('Movimentação já foi eliminada ou não existe para esta linha');

  const result = await deleteImportedStockMovements({
    batchId: params.batchId,
    actor: params.actor,
    movements: [movement],
    allowDeleteWithoutCostRollback: params.allowDeleteWithoutCostRollback,
  });
  await updateBatchRollbackState(params.batchId);
  const summary = await refreshBatchSummary(params.batchId);

  return { ...result, summary };
}

export async function archiveStockMovementImportBatch(batchId: string) {
  const db = prismaClient as any;
  await db.stockMovementImportBatch.update({
    where: { id: batchId },
    data: { archivedAt: new Date(), status: 'archived' },
  });
}

export async function deleteStockMovementImportBatch(batchId: string) {
  const db = prismaClient as any;
  const batch = await db.stockMovementImportBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
    },
  });

  if (!batch) {
    throw new Error('Lote não encontrado');
  }

  const activeMovements = await db.stockMovement.findMany({
    where: {
      importBatchId: batchId,
      deletedAt: null,
    },
    orderBy: [{ appliedAt: 'desc' }],
    select: {
      id: true,
      importLineId: true,
      itemVariationId: true,
      previousCostAmount: true,
      previousCostUnit: true,
      metadata: true,
    },
  });

  if (activeMovements.length > 0) {
    await deleteImportedStockMovements({
      batchId,
      actor: 'system:batch-delete',
      movements: activeMovements,
    });
    await updateBatchRollbackState(batchId, { forceRolledBackAt: true });
  }

  await db.stockMovementImportBatch.delete({
    where: { id: batchId },
  });
}

export async function listStockMovementImportBatches(limit = 30) {
  const db = prismaClient as any;
  if (typeof db.stockMovementImportBatch?.findMany !== 'function') return [];
  return await db.stockMovementImportBatch.findMany({
    where: { archivedAt: null },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      name: true,
      sourceType: true,
      status: true,
      originalFileName: true,
      worksheetName: true,
      supplierNotesFileName: true,
      supplierNotesAttachedAt: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      uploadedBy: true,
      appliedAt: true,
      rolledBackAt: true,
      summary: true,
    },
  });
}

export async function getStockMovementImportBatchView(batchId: string) {
  const db = prismaClient as any;
  if (!batchId || typeof db.stockMovementImportBatch?.findUnique !== 'function') return null;
  await ensureSyntheticInvoiceNumbersForVisionBatch(batchId);
  await refreshBatchSummary(batchId);

  const [batch, lines, items, changes] = await Promise.all([
    db.stockMovementImportBatch.findUnique({ where: { id: batchId } }),
    db.stockMovementImportBatchLine.findMany({ where: { batchId }, orderBy: [{ rowNumber: 'asc' }] }),
    db.item.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        classification: true,
        purchaseUm: true,
        consumptionUm: true,
        purchaseToConsumptionFactor: true,
        ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
      },
      orderBy: [{ name: 'asc' }],
      take: 2000,
    }),
    db.stockMovement.findMany({
      where: { importBatchId: batchId },
      orderBy: [{ appliedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        direction: true,
        movementType: true,
        itemId: true,
        quantityAmount: true,
        quantityUnit: true,
        previousCostAmount: true,
        previousCostUnit: true,
        newCostAmount: true,
        newCostUnit: true,
        appliedAt: true,
        deletedAt: true,
        ImportBatch: {
          select: {
            id: true,
            name: true,
          },
        },
        Item: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }).then((rows: any[]) => rows.map((row) => ({
      ...row,
      stockMovementId: row.id,
      Batch: row.ImportBatch || null,
      rolledBackAt: row.deletedAt || null,
      rollbackStatus: null,
      rollbackMessage: null,
    }))),
  ]);

  if (!batch) return null;

  const groupedPendingMapping = new Map<string, any>();
  for (const line of lines.filter((l: any) => l.status === 'pending_mapping')) {
    const key = String(line.ingredientNameNormalized || normalizeName(line.ingredientName));
    if (!groupedPendingMapping.has(key)) {
      groupedPendingMapping.set(key, {
        ingredientName: line.ingredientName,
        ingredientNameNormalized: key,
        count: 0,
        lineIds: [] as string[],
      });
    }
    const group = groupedPendingMapping.get(key);
    group.count += 1;
    group.lineIds.push(line.id);
  }

  const pendingMappingGroups = Array.from(groupedPendingMapping.values()).map((group) => ({
    ...group,
    suggestions: buildSuggestions(group.ingredientName, items, 5),
  }));

  const summary = summarizeLines(lines);
  return { batch, lines, items, pendingMappingGroups, summary, appliedChanges: changes };
}

export async function listStockMovementImportMovements(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  movementId?: string;
  lineId?: string;
  supplier?: string;
  item?: string;
  itemId?: string;
  from?: Date | null;
  to?: Date | null;
  status?: 'active' | 'deleted' | 'all';
}) {
  const db = prismaClient as any;
  const page = Math.max(1, Math.floor(Number(params.page || 1)));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(params.pageSize || 50))));
  const q = str(params.q);
  const movementId = str(params.movementId);
  const lineId = str(params.lineId);
  const supplier = str(params.supplier);
  const item = str(params.item);
  const itemId = str(params.itemId);
  const status = params.status === 'deleted' || params.status === 'all' ? params.status : 'active';
  if (typeof db.stockMovement?.findMany !== 'function') {
    return {
      rows: [],
      summary: {
        total: 0,
        active: 0,
        deleted: 0,
        uniqueItems: 0,
        uniqueSuppliers: 0,
      },
      pagination: {
        page,
        pageSize,
        totalItems: 0,
        totalPages: 1,
      },
    };
  }

  const where: any = {};
  const andClauses: any[] = [];

  if (status === 'active') {
    where.deletedAt = null;
  } else if (status === 'deleted') {
    where.deletedAt = { not: null };
  }

  if (params.from || params.to) {
    where.movementAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  if (itemId) {
    where.itemId = itemId;
  }

  if (movementId) {
    where.id = movementId;
  }

  if (lineId) {
    where.importLineId = lineId;
  }

  if (supplier) {
    andClauses.push({
      supplierName: { contains: supplier, mode: 'insensitive' },
    });
  }

  if (item) {
    andClauses.push({
      OR: [
        { Item: { is: { name: { contains: item, mode: 'insensitive' } } } },
        { ImportLine: { is: { ingredientName: { contains: item, mode: 'insensitive' } } } },
      ],
    });
  }

  if (q) {
    andClauses.push({
      OR: [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { supplierName: { contains: q, mode: 'insensitive' } },
        { ImportBatch: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { Item: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { ImportLine: { is: { ingredientName: { contains: q, mode: 'insensitive' } } } },
      ],
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  const [totalItems, rows, activeCount, deletedCount, uniqueItemsRows, uniqueSuppliersRows] = await Promise.all([
    db.stockMovement.count({ where }),
    db.stockMovement.findMany({
      where,
      orderBy: [{ movementAt: 'desc' }, { appliedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        direction: true,
        movementType: true,
        originType: true,
        originRefId: true,
        importBatchId: true,
        importLineId: true,
        itemId: true,
        quantityAmount: true,
        quantityUnit: true,
        previousCostAmount: true,
        previousCostUnit: true,
        newCostAmount: true,
        newCostUnit: true,
        movementUnit: true,
        conversionSource: true,
        conversionFactorUsed: true,
        invoiceNumber: true,
        supplierId: true,
        supplierName: true,
        supplierCnpj: true,
        movementAt: true,
        appliedBy: true,
        appliedAt: true,
        deletedAt: true,
        metadata: true,
        ImportBatch: {
          select: {
            id: true,
            name: true,
          },
        },
        Item: {
          select: {
            id: true,
            name: true,
            classification: true,
          },
        },
        ImportLine: {
          select: {
            id: true,
            rowNumber: true,
            status: true,
            errorCode: true,
            errorMessage: true,
            movementAt: true,
            invoiceNumber: true,
            supplierId: true,
            supplierName: true,
            supplierCnpj: true,
            supplierReconciliationStatus: true,
            supplierReconciliationSource: true,
            ingredientName: true,
            motivo: true,
            identification: true,
            qtyEntry: true,
            unitEntry: true,
            qtyConsumption: true,
            unitConsumption: true,
            movementUnit: true,
            costAmount: true,
            costTotalAmount: true,
            observation: true,
            mappedItemId: true,
            mappedItemName: true,
            mappingSource: true,
            manualConversionFactor: true,
            targetUnit: true,
            convertedCostAmount: true,
            conversionSource: true,
            conversionFactorUsed: true,
            appliedAt: true,
            rolledBackAt: true,
          },
        },
      },
    }),
    db.stockMovement.count({ where: { ...where, deletedAt: null } }),
    db.stockMovement.count({ where: { ...where, deletedAt: { not: null } } }),
    db.stockMovement.findMany({
      where,
      distinct: ['itemId'],
      select: { itemId: true },
    }),
    db.stockMovement.findMany({
      where,
      distinct: ['supplierId', 'supplierName'],
      select: { supplierId: true, supplierName: true },
    }),
  ]);

  return {
    rows: rows.map((row: any) => ({
      ...row,
      batchId: row.importBatchId || null,
      lineId: row.importLineId || null,
      Batch: row.ImportBatch || null,
      Line: row.ImportLine || null,
    })),
    summary: {
      total: totalItems,
      active: activeCount,
      deleted: deletedCount,
      uniqueItems: uniqueItemsRows.filter((row: any) => Boolean(row.itemId)).length,
      uniqueSuppliers: uniqueSuppliersRows.filter((row: any) => Boolean(row.supplierId || row.supplierName)).length,
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
  };
}
