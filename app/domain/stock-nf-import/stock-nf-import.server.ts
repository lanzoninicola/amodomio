import { createHash, randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import prismaClient from '~/lib/prisma/client.server';
import { itemVariationPrismaEntity } from '~/domain/item/item-variation.prisma.entity.server';
import { itemCostVariationPrismaEntity } from '~/domain/item/item-cost-variation.prisma.entity.server';

const SOURCE_SYSTEM = 'saipos';
const SOURCE_TYPE = 'entrada_nf';
const COST_REFERENCE_TYPE_LINE = 'stock-nf-import-line';

export type BatchSummary = {
  total: number;
  ready: number;
  invalid: number;
  pendingMapping: number;
  pendingConversion: number;
  applied: number;
  skippedDuplicate: number;
  error: number;
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
  const match = raw.match(/NF\s*:\s*([A-Za-z0-9\-./]+)/i);
  return match?.[1] || null;
}

function hashFingerprint(input: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function isEmptyRow(row: unknown[]) {
  return row.every((v) => str(v) === '');
}

function findHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) => normalizeName(row?.[0]) === 'DATA:' && normalizeName(row?.[1]) === 'INGREDIENTE');
}

async function loadItemsAndAliases() {
  const db = prismaClient as any;
  const [items, aliases] = await Promise.all([
    db.item.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        purchaseUm: true,
        consumptionUm: true,
        purchaseToConsumptionFactor: true,
      },
      orderBy: [{ name: 'asc' }],
    }),
    typeof db.itemImportAlias?.findMany === 'function'
      ? db.itemImportAlias.findMany({
          where: { active: true, sourceSystem: SOURCE_SYSTEM, sourceType: SOURCE_TYPE },
          select: { id: true, aliasName: true, aliasNormalized: true, itemId: true },
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
  return { items, itemsById, itemsByNormalized, aliasByNormalized };
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
  return str(item?.purchaseUm || item?.consumptionUm).toUpperCase() || null;
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

  const itemPurchaseUm = str(item?.purchaseUm).toUpperCase() || null;
  const itemConsumptionUm = str(item?.consumptionUm).toUpperCase() || null;
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

async function classifyLine(line: any, lookup: Awaited<ReturnType<typeof loadItemsAndAliases>>) {
  const motivoNorm = normalizeName(line.motivo);
  if (motivoNorm !== 'ENTRADA POR NF') {
    return {
      ...line,
      status: 'invalid',
      errorCode: 'motivo_not_supported',
      errorMessage: 'Motivo diferente de Entrada por NF',
    };
  }

  if (!line.movementAt) {
    return { ...line, status: 'invalid', errorCode: 'invalid_date', errorMessage: 'Data inválida' };
  }
  if (!line.invoiceNumber) {
    return { ...line, status: 'invalid', errorCode: 'missing_invoice', errorMessage: 'NF não identificada' };
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
  return {
    ...line,
    mappedItemId: mapping.item.id,
    mappedItemName: mapping.item.name,
    mappingSource: mapping.source,
    status: conv.status,
    errorCode: conv.status === 'ready' ? null : conv.errorCode,
    errorMessage: conv.status === 'ready' ? null : conv.errorMessage,
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
    invalid: 0,
    pendingMapping: 0,
    pendingConversion: 0,
    applied: 0,
    skippedDuplicate: 0,
    error: 0,
  };
  for (const line of lines) {
    switch (String(line.status)) {
      case 'ready': summary.ready += 1; break;
      case 'invalid': summary.invalid += 1; break;
      case 'pending_mapping': summary.pendingMapping += 1; break;
      case 'pending_conversion': summary.pendingConversion += 1; break;
      case 'applied': summary.applied += 1; break;
      case 'skipped_duplicate': summary.skippedDuplicate += 1; break;
      case 'error': summary.error += 1; break;
      default: break;
    }
  }
  return summary;
}

function derivePreApplyBatchStatus(summary: BatchSummary) {
  if (summary.total === 0) return 'draft';
  if (summary.invalid || summary.pendingMapping || summary.pendingConversion) return 'draft';
  return 'validated';
}

async function markExistingAppliedDuplicates(lines: any[]) {
  const fingerprints = Array.from(new Set(lines.map((line) => line.sourceFingerprint).filter(Boolean)));
  if (fingerprints.length === 0) return new Set<string>();

  const db = prismaClient as any;
  const existing = await db.stockNfImportBatchLine.findMany({
    where: {
      sourceFingerprint: { in: fingerprints },
      appliedAt: { not: null },
      Batch: {
        is: {
          status: { in: ['applied', 'partial'] },
          rolledBackAt: null,
        },
      },
    },
    select: { sourceFingerprint: true },
  });

  return new Set(existing.map((row: any) => String(row.sourceFingerprint)));
}

export async function createStockNfImportBatchFromFile(params: {
  fileName: string;
  fileBuffer: Buffer;
  batchName: string;
  uploadedBy?: string | null;
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

    const sourceFingerprint = hashFingerprint({
      sourceSystem: SOURCE_SYSTEM,
      sourceType: SOURCE_TYPE,
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
        },
      },
      lookup,
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
  const batch = await db.stockNfImportBatch.create({
    data: {
      name: str(params.batchName) || `Importação NF ${new Date().toLocaleString('pt-BR')}`,
      sourceSystem: SOURCE_SYSTEM,
      sourceType: SOURCE_TYPE,
      status: derivePreApplyBatchStatus(summary),
      originalFileName: params.fileName,
      worksheetName: sheetName,
      periodStart,
      periodEnd,
      uploadedBy: params.uploadedBy || null,
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
          qtyEntry: line.qtyEntry,
          unitEntry: line.unitEntry || null,
          qtyConsumption: line.qtyConsumption,
          unitConsumption: line.unitConsumption || null,
          movementUnit: line.movementUnit || null,
          costAmount: line.costAmount,
          costTotalAmount: line.costTotalAmount,
          observation: line.observation || null,
          sourceFingerprint: line.sourceFingerprint,
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

async function recomputeBatchLines(batchId: string) {
  const db = prismaClient as any;
  const [lines, lookup] = await Promise.all([
    db.stockNfImportBatchLine.findMany({ where: { batchId }, orderBy: [{ rowNumber: 'asc' }] }),
    loadItemsAndAliases(),
  ]);

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

    if (String(line.status) === 'skipped_duplicate' && String(line.errorCode) === 'duplicate_in_batch') {
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
          next = {
            ...next,
            mappedItemName: item.name,
            status: conv.status,
            errorCode: conv.status === 'ready' ? null : (conv as any).errorCode,
            errorMessage: conv.status === 'ready' ? null : (conv as any).errorMessage,
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
          next = {
            ...next,
            mappedItemId: auto.item.id,
            mappedItemName: auto.item.name,
            mappingSource: auto.source,
            status: conv.status,
            errorCode: conv.status === 'ready' ? null : (conv as any).errorCode,
            errorMessage: conv.status === 'ready' ? null : (conv as any).errorMessage,
            targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(auto.item),
            convertedCostAmount: (conv as any).convertedCostAmount ?? null,
            conversionSource: (conv as any).conversionSource ?? null,
            conversionFactorUsed: (conv as any).conversionFactorUsed ?? null,
          };
        }
      }
    }

    await db.stockNfImportBatchLine.update({
      where: { id: line.id },
      data: next,
    });
  }

  return await refreshBatchSummary(batchId);
}

export async function refreshBatchSummary(batchId: string) {
  const db = prismaClient as any;
  const lines = await db.stockNfImportBatchLine.findMany({ where: { batchId }, select: { status: true } });
  const summary = summarizeLines(lines);

  const batch = await db.stockNfImportBatch.findUnique({ where: { id: batchId }, select: { appliedAt: true, rolledBackAt: true } });
  let status = derivePreApplyBatchStatus(summary);
  if (batch?.appliedAt && !batch?.rolledBackAt) {
    status = summary.ready > 0 || summary.pendingMapping > 0 || summary.pendingConversion > 0 || summary.error > 0 ? 'partial' : 'applied';
  }
  if (batch?.rolledBackAt) {
    status = 'rolled_back';
  }

  await db.stockNfImportBatch.update({
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
    select: { id: true, name: true, purchaseUm: true, consumptionUm: true, purchaseToConsumptionFactor: true, active: true },
  });
  if (!item) throw new Error('Item não encontrado');

  const where: any = { batchId: params.batchId };
  if (params.applyToAllSameIngredient && params.ingredientNameNormalized) {
    where.ingredientNameNormalized = params.ingredientNameNormalized;
    where.appliedAt = null;
  } else if (params.lineId) {
    where.id = params.lineId;
  } else {
    throw new Error('Linha inválida para mapear');
  }

  const lines = await db.stockNfImportBatchLine.findMany({ where });
  for (const line of lines) {
    const conv = await resolveConversionForLine({ ...line, mappedItemId: item.id }, item);
    await db.stockNfImportBatchLine.update({
      where: { id: line.id },
      data: {
        mappedItemId: item.id,
        mappedItemName: item.name,
        mappingSource: 'manual',
        status: conv.status,
        errorCode: conv.status === 'ready' ? null : (conv as any).errorCode,
        errorMessage: conv.status === 'ready' ? null : (conv as any).errorMessage,
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
            sourceType: SOURCE_TYPE,
            aliasNormalized: aliasLine.ingredientNameNormalized,
          },
        },
        create: {
          sourceSystem: SOURCE_SYSTEM,
          sourceType: SOURCE_TYPE,
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
  const line = await db.stockNfImportBatchLine.findUnique({ where: { id: params.lineId } });
  if (!line || line.batchId !== params.batchId) throw new Error('Linha inválida');

  await db.stockNfImportBatchLine.update({
    where: { id: params.lineId },
    data: { manualConversionFactor: params.factor },
  });

  await recomputeBatchLines(params.batchId);
}

async function getBatchReadyLines(batchId: string) {
  const db = prismaClient as any;
  return await db.stockNfImportBatchLine.findMany({
    where: { batchId, status: 'ready', appliedAt: null },
    orderBy: [{ rowNumber: 'asc' }],
  });
}

export async function applyStockNfImportBatch(params: { batchId: string; actor?: string | null }) {
  const db = prismaClient as any;
  const batch = await db.stockNfImportBatch.findUnique({ where: { id: params.batchId } });
  if (!batch) throw new Error('Lote não encontrado');
  if (batch.rolledBackAt) throw new Error('Lote já foi revertido');

  await recomputeBatchLines(params.batchId);
  const readyLines = await getBatchReadyLines(params.batchId);
  let applied = 0;
  let errors = 0;

  for (const line of readyLines) {
    try {
      const duplicateApplied = await db.stockNfImportBatchLine.findFirst({
        where: {
          sourceFingerprint: line.sourceFingerprint,
          id: { not: line.id },
          appliedAt: { not: null },
          Batch: { is: { rolledBackAt: null } },
        },
        select: { id: true },
      });

      if (duplicateApplied) {
        await db.stockNfImportBatchLine.update({
          where: { id: line.id },
          data: {
            status: 'skipped_duplicate',
            errorCode: 'duplicate_already_applied',
            errorMessage: 'Linha já aplicada em outro lote',
          },
        });
        continue;
      }

      const item = await db.item.findUnique({
        where: { id: line.mappedItemId },
        select: { id: true, name: true },
      });
      if (!item) {
        await db.stockNfImportBatchLine.update({
          where: { id: line.id },
          data: { status: 'error', errorCode: 'item_missing_apply', errorMessage: 'Item não encontrado na aplicação' },
        });
        errors += 1;
        continue;
      }

      const baseVar = await itemVariationPrismaEntity.ensureBaseVariationForItem(item.id);
      const currentCost = await db.itemCostVariation.findUnique({ where: { itemVariationId: baseVar.id } });
      const nextCost = Number(line.convertedCostAmount ?? NaN);
      if (!(nextCost > 0)) {
        await db.stockNfImportBatchLine.update({
          where: { id: line.id },
          data: { status: 'error', errorCode: 'invalid_converted_cost', errorMessage: 'Custo convertido inválido' },
        });
        errors += 1;
        continue;
      }

      await itemCostVariationPrismaEntity.setCurrentCost({
        itemVariationId: baseVar.id,
        costAmount: nextCost,
        unit: line.targetUnit || line.movementUnit || null,
        source: 'import',
        referenceType: COST_REFERENCE_TYPE_LINE,
        referenceId: line.id,
        validFrom: line.movementAt || new Date(),
        updatedBy: params.actor || null,
        metadata: {
          importBatchId: params.batchId,
          importLineId: line.id,
          sourceSystem: SOURCE_SYSTEM,
          sourceType: SOURCE_TYPE,
          ingredientName: line.ingredientName,
          invoiceNumber: line.invoiceNumber,
          movementUnit: line.movementUnit,
          targetUnit: line.targetUnit,
          conversionSource: line.conversionSource,
          conversionFactorUsed: line.conversionFactorUsed,
          qtyEntry: line.qtyEntry,
          qtyConsumption: line.qtyConsumption,
          rawCostAmount: line.costAmount,
          rawCostTotalAmount: line.costTotalAmount,
        },
      });

      await db.stockNfImportAppliedChange.create({
        data: {
          batchId: params.batchId,
          lineId: line.id,
          itemId: item.id,
          itemVariationId: baseVar.id,
          previousCostVariationId: currentCost?.id || null,
          previousCostAmount: currentCost?.costAmount ?? null,
          previousCostUnit: currentCost?.unit ?? null,
          newCostAmount: nextCost,
          newCostUnit: line.targetUnit || line.movementUnit || null,
          movementUnit: line.movementUnit || null,
          conversionSource: line.conversionSource || null,
          conversionFactorUsed: line.conversionFactorUsed ?? null,
          invoiceNumber: line.invoiceNumber || null,
          movementAt: line.movementAt || null,
          appliedBy: params.actor || null,
          metadata: {
            ingredientName: line.ingredientName,
            sourceFingerprint: line.sourceFingerprint,
            rowNumber: line.rowNumber,
          },
        },
      });

      await db.stockNfImportBatchLine.update({
        where: { id: line.id },
        data: {
          status: 'applied',
          appliedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      applied += 1;
    } catch (error) {
      await db.stockNfImportBatchLine.update({
        where: { id: line.id },
        data: {
          status: 'error',
          errorCode: 'apply_error',
          errorMessage: error instanceof Error ? error.message : 'Erro ao aplicar linha',
        },
      });
      errors += 1;
    }
  }

  await db.stockNfImportBatch.update({
    where: { id: params.batchId },
    data: { appliedAt: new Date() },
  });
  const summary = await refreshBatchSummary(params.batchId);

  return { applied, errors, summary };
}

export async function rollbackStockNfImportBatch(params: { batchId: string; actor?: string | null }) {
  const db = prismaClient as any;
  const batch = await db.stockNfImportBatch.findUnique({ where: { id: params.batchId } });
  if (!batch) throw new Error('Lote não encontrado');
  const changes = await db.stockNfImportAppliedChange.findMany({
    where: { batchId: params.batchId, rolledBackAt: null },
    orderBy: [{ appliedAt: 'desc' }],
  });

  let rolledBack = 0;
  let conflicts = 0;
  let errors = 0;

  for (const change of changes) {
    try {
      const current = await db.itemCostVariation.findUnique({ where: { itemVariationId: change.itemVariationId } });
      if (!current) {
        await db.stockNfImportAppliedChange.update({
          where: { id: change.id },
          data: { rollbackStatus: 'conflict', rollbackMessage: 'Custo atual não encontrado' },
        });
        conflicts += 1;
        continue;
      }

      const currentRefType = str(current.referenceType);
      const currentRefId = str(current.referenceId);
      if (currentRefType !== COST_REFERENCE_TYPE_LINE || currentRefId !== change.lineId) {
        await db.stockNfImportAppliedChange.update({
          where: { id: change.id },
          data: {
            rollbackStatus: 'conflict',
            rollbackMessage: 'Item foi alterado após esta importação; referência atual difere',
          },
        });
        conflicts += 1;
        continue;
      }

      const previousAmount = Number(change.previousCostAmount ?? NaN);
      if (Number.isFinite(previousAmount) && previousAmount >= 0) {
        await itemCostVariationPrismaEntity.setCurrentCost({
          itemVariationId: change.itemVariationId,
          costAmount: previousAmount,
          unit: change.previousCostUnit || null,
          source: 'import',
          referenceType: 'stock-nf-import-rollback',
          referenceId: change.id,
          validFrom: new Date(),
          updatedBy: params.actor || null,
          metadata: {
            rollbackOfBatchId: params.batchId,
            rollbackOfLineId: change.lineId,
            restoredFromAppliedChangeId: change.id,
          },
        });
      }

      await db.stockNfImportAppliedChange.update({
        where: { id: change.id },
        data: {
          rolledBackAt: new Date(),
          rollbackStatus: 'success',
          rollbackMessage: null,
        },
      });

      await db.stockNfImportBatchLine.update({
        where: { id: change.lineId },
        data: {
          rolledBackAt: new Date(),
          status: 'ready',
          appliedAt: null,
        },
      });
      rolledBack += 1;
    } catch (error) {
      await db.stockNfImportAppliedChange.update({
        where: { id: change.id },
        data: {
          rollbackStatus: 'error',
          rollbackMessage: error instanceof Error ? error.message : 'Erro no rollback',
        },
      });
      errors += 1;
    }
  }

  await db.stockNfImportBatch.update({
    where: { id: params.batchId },
    data: { rolledBackAt: new Date(), status: conflicts || errors ? 'partial' : 'rolled_back' },
  });
  const summary = await refreshBatchSummary(params.batchId);

  return { rolledBack, conflicts, errors, summary };
}

export async function archiveStockNfImportBatch(batchId: string) {
  const db = prismaClient as any;
  await db.stockNfImportBatch.update({
    where: { id: batchId },
    data: { archivedAt: new Date(), status: 'archived' },
  });
}

export async function listStockNfImportBatches(limit = 30) {
  const db = prismaClient as any;
  if (typeof db.stockNfImportBatch?.findMany !== 'function') return [];
  return await db.stockNfImportBatch.findMany({
    where: { archivedAt: null },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      name: true,
      status: true,
      originalFileName: true,
      worksheetName: true,
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

export async function getStockNfImportBatchView(batchId: string) {
  const db = prismaClient as any;
  if (!batchId || typeof db.stockNfImportBatch?.findUnique !== 'function') return null;

  const [batch, lines, items, changes] = await Promise.all([
    db.stockNfImportBatch.findUnique({ where: { id: batchId } }),
    db.stockNfImportBatchLine.findMany({ where: { batchId }, orderBy: [{ rowNumber: 'asc' }] }),
    db.item.findMany({
      where: { active: true },
      select: { id: true, name: true, classification: true, purchaseUm: true, consumptionUm: true },
      orderBy: [{ name: 'asc' }],
      take: 2000,
    }),
    db.stockNfImportAppliedChange.findMany({ where: { batchId }, orderBy: [{ appliedAt: 'desc' }], take: 200 }),
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
