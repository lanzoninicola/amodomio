import { createHash, randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import prismaClient from '~/lib/prisma/client.server';
import { itemVariationPrismaEntity } from '~/domain/item/item-variation.prisma.entity.server';
import { itemCostVariationPrismaEntity } from '~/domain/item/item-cost-variation.prisma.entity.server';
import { runCostImpactPipelineForItemChange } from '~/domain/costs/cost-impact-pipeline.server';

const SOURCE_SYSTEM = 'saipos';
const SOURCE_TYPE = 'entrada_nf';
const COST_REFERENCE_TYPE_LINE = 'stock-nf-import-line';

export type BatchSummary = {
  total: number;
  ready: number;
  invalid: number;
  pendingMapping: number;
  pendingSupplier: number;
  pendingConversion: number;
  applied: number;
  ignored: number;
  skippedDuplicate: number;
  error: number;
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
      },
      orderBy: [{ name: 'asc' }],
    }),
    typeof db.itemImportAlias?.findMany === 'function'
      ? db.itemImportAlias.findMany({
          where: { active: true, sourceSystem: SOURCE_SYSTEM, sourceType: SOURCE_TYPE },
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
  if (!line.supplierId) {
    return {
      ...line,
      status: 'pending_supplier',
      errorCode: 'supplier_not_reconciled',
      errorMessage: 'Fornecedor do documento não conciliado',
    };
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
    pendingSupplier: 0,
    pendingConversion: 0,
    applied: 0,
    ignored: 0,
    skippedDuplicate: 0,
    error: 0,
  };
  for (const line of lines) {
    switch (String(line.status)) {
      case 'ready': summary.ready += 1; break;
      case 'invalid': summary.invalid += 1; break;
      case 'pending_mapping': summary.pendingMapping += 1; break;
      case 'pending_supplier': summary.pendingSupplier += 1; break;
      case 'pending_conversion': summary.pendingConversion += 1; break;
      case 'applied': summary.applied += 1; break;
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
  if (summary.invalid || summary.pendingMapping || summary.pendingSupplier || summary.pendingConversion) return 'draft';
  return 'validated';
}

function finalizeReadyStatusForSupplier(line: any, next: any) {
  if (next.status !== 'ready') return next;
  if (line.supplierId) return next;

  return {
    ...next,
    status: 'pending_supplier',
    errorCode: 'supplier_not_reconciled',
    errorMessage: 'Fornecedor do documento não conciliado',
  };
}

async function markExistingAppliedDuplicates(lines: any[]) {
  const fingerprints = Array.from(new Set(lines.map((line) => line.sourceFingerprint).filter(Boolean)));
  if (fingerprints.length === 0) return new Set<string>();

  const db = prismaClient as any;
  const [appliedChanges, existingLines] = await Promise.all([
    prismaClient.$queryRaw<Array<{ source_fingerprint: string }>>(Prisma.sql`
      SELECT DISTINCT coalesce(ac.metadata->>'sourceFingerprint', '') AS source_fingerprint
      FROM stock_nf_import_applied_changes ac
      WHERE ac.rolled_back_at IS NULL
        AND coalesce(ac.metadata->>'sourceFingerprint', '') IN (${Prisma.join(fingerprints)})
    `).catch(() => []),
    db.stockNfImportBatchLine.findMany({
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
    }),
  ]);

  const detected = new Set<string>();
  for (const row of appliedChanges) {
    const fingerprint = String(row?.source_fingerprint || '').trim();
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

  const rows = await prismaClient.$queryRaw<Array<{ exists: number }>>(Prisma.sql`
    SELECT 1 AS exists
    FROM stock_nf_import_applied_changes ac
    WHERE ac.rolled_back_at IS NULL
      AND coalesce(ac.metadata->>'sourceFingerprint', '') = ${fingerprint}
    LIMIT 1
  `).catch(() => []);

  if (rows.length > 0) return true;

  const db = prismaClient as any;
  const existingLine = await db.stockNfImportBatchLine.findFirst({
    where: {
      sourceFingerprint: fingerprint,
      appliedAt: { not: null },
      Batch: {
        is: {
          rolledBackAt: null,
        },
      },
    },
    select: { id: true },
  });

  return Boolean(existingLine?.id);
}

export async function createStockNfImportBatchFromFile(params: {
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
        supplierId: matchedSupplier.supplierId,
        supplierName: matchedSupplier.supplierName,
        supplierNameNormalized: matchedSupplier.supplierNameNormalized,
        supplierCnpj: matchedSupplier.supplierCnpj,
        supplierMatchSource: matchedSupplier.supplierMatchSource,
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
      name: str(params.batchName) || `Importação de movimentações ${new Date().toLocaleString('pt-BR')}`,
      sourceSystem: SOURCE_SYSTEM,
      sourceType: SOURCE_TYPE,
      status: derivePreApplyBatchStatus(summary),
      originalFileName: params.fileName,
      worksheetName: sheetName,
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

export async function createStockNfImportBatchFromVisionPayload(params: {
  batchName: string;
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
    const qtyEntry = Number(rawLine.qtyEntry ?? NaN);
    const qtyConsumption = Number(rawLine.qtyConsumption ?? NaN);
    const costAmount = Number(rawLine.costAmount ?? NaN);
    const costTotalAmount = Number(rawLine.costTotalAmount ?? NaN);
    const rowNumber = Number(rawLine.rowNumber || index + 1);
    const movementUnit =
      str(rawLine.movementUnit || rawLine.unitEntry || rawLine.unitConsumption).toUpperCase() || null;

    const sourceFingerprint = hashFingerprint({
      sourceSystem: SOURCE_SYSTEM,
      sourceType: SOURCE_TYPE,
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

  const batch = await db.stockNfImportBatch.create({
    data: {
      name: str(params.batchName) || `Importação de movimentações por foto ${new Date().toLocaleString('pt-BR')}`,
      sourceSystem: SOURCE_SYSTEM,
      sourceType: SOURCE_TYPE,
      status: derivePreApplyBatchStatus(summary),
      originalFileName: str(params.originalFileName) || 'chatgpt-photo-import.json',
      worksheetName: str(params.worksheetName) || 'chatgpt-vision',
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

async function recomputeBatchLines(batchId: string) {
  const db = prismaClient as any;
  await ensureSyntheticInvoiceNumbersForVisionBatch(batchId);
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
          next = finalizeReadyStatusForSupplier(line, {
            ...next,
            mappedItemName: item.name,
            status: conv.status,
            errorCode: conv.status === 'ready' ? null : (conv as any).errorCode,
            errorMessage: conv.status === 'ready' ? null : (conv as any).errorMessage,
            targetUnit: (conv as any).targetUnit ?? resolveTargetUnit(item),
            convertedCostAmount: (conv as any).convertedCostAmount ?? null,
            conversionSource: (conv as any).conversionSource ?? null,
            conversionFactorUsed: (conv as any).conversionFactorUsed ?? null,
          });
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
          next = finalizeReadyStatusForSupplier(line, {
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
          });
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

async function ensureSyntheticInvoiceNumbersForVisionBatch(batchId: string) {
  const db = prismaClient as any;
  const batch = await db.stockNfImportBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
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
  const isVisionBatch =
    String(batch.worksheetName || '') === 'chatgpt-vision' ||
    String(batch.originalFileName || '') === 'chatgpt-photo-import.json';
  if (!isVisionBatch) return;

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

    await db.stockNfImportBatchLine.update({
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
  const lines = await db.stockNfImportBatchLine.findMany({ where: { batchId }, select: { status: true } });
  const summary = summarizeLines(lines);

  const batch = await db.stockNfImportBatch.findUnique({ where: { id: batchId }, select: { appliedAt: true, rolledBackAt: true } });
  let status = derivePreApplyBatchStatus(summary);
  if (batch?.appliedAt && !batch?.rolledBackAt) {
    status = summary.ready > 0 || summary.pendingMapping > 0 || summary.pendingSupplier > 0 || summary.pendingConversion > 0 || summary.error > 0 ? 'partial' : 'applied';
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
      data: finalizeReadyStatusForSupplier(line, {
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
      }),
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

export async function setBatchLineIgnored(params: {
  batchId: string;
  lineId: string;
  ignored: boolean;
}) {
  const db = prismaClient as any;
  const line = await db.stockNfImportBatchLine.findUnique({ where: { id: params.lineId } });
  if (!line || line.batchId !== params.batchId) throw new Error('Linha inválida');
  if (line.appliedAt) throw new Error('Linha já aplicada não pode ser ignorada');

  if (params.ignored) {
    await db.stockNfImportBatchLine.update({
      where: { id: params.lineId },
      data: {
        status: 'ignored',
        errorCode: 'ignored_by_user',
        errorMessage: 'Linha ignorada manualmente',
      },
    });
    await refreshBatchSummary(params.batchId);
    return;
  }

  await db.stockNfImportBatchLine.update({
    where: { id: params.lineId },
    data: {
      status: 'draft',
      errorCode: null,
      errorMessage: null,
    },
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
      if (await hasActiveAppliedFingerprint(line.sourceFingerprint)) {
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

      const baseVar = await itemVariationPrismaEntity.findPrimaryVariationForItem(item.id, {
        ensureBaseIfMissing: true,
      });
      if (!baseVar?.id) {
        await db.stockNfImportBatchLine.update({
          where: { id: line.id },
          data: { status: 'error', errorCode: 'item_variation_missing_apply', errorMessage: 'Nenhuma variação disponível para aplicar o custo' },
        });
        errors += 1;
        continue;
      }
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
          supplierId: line.supplierId,
          supplierName: line.supplierName,
          supplierCnpj: line.supplierCnpj,
          supplierMatchSource: line.supplierMatchSource,
          movementUnit: line.movementUnit,
          targetUnit: line.targetUnit,
          conversionSource: line.conversionSource,
          conversionFactorUsed: line.conversionFactorUsed,
          qtyEntry: line.qtyEntry,
          qtyConsumption: line.qtyConsumption,
          rawCostAmount: line.costAmount,
          rawCostTotalAmount: line.costTotalAmount,
          sourceFingerprint: line.sourceFingerprint,
        },
      });

      const appliedChange = await db.stockNfImportAppliedChange.create({
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
          supplierId: line.supplierId || null,
          supplierName: line.supplierName || null,
          supplierCnpj: line.supplierCnpj || null,
          movementAt: line.movementAt || null,
          appliedBy: params.actor || null,
          metadata: {
            ingredientName: line.ingredientName,
            sourceFingerprint: line.sourceFingerprint,
            rowNumber: line.rowNumber,
          },
        },
      });

      await runCostImpactPipelineForItemChange({
        db,
        itemId: item.id,
        sourceType: 'stock-nf-import',
        sourceRefId: appliedChange.id,
        updatedBy: params.actor || 'system:stock-nf-import',
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

export async function deleteStockNfImportBatch(batchId: string) {
  const db = prismaClient as any;
  const batch = await db.stockNfImportBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      AppliedChanges: {
        where: { rolledBackAt: null },
        select: { id: true },
        take: 1,
      },
      Lines: {
        where: { appliedAt: { not: null } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!batch) {
    throw new Error('Lote não encontrado');
  }

  const wasImportedAsStockMovement =
    (batch.AppliedChanges?.length || 0) > 0 ||
    (batch.Lines?.length || 0) > 0;

  if (wasImportedAsStockMovement) {
    throw new Error('Não é permitido eliminar um lote que já foi importado como movimentação de estoque');
  }

  await db.stockNfImportBatch.delete({
    where: { id: batchId },
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
  await ensureSyntheticInvoiceNumbersForVisionBatch(batchId);
  await refreshBatchSummary(batchId);

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

export async function listStockNfImportMovements(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  supplier?: string;
  item?: string;
  itemId?: string;
  from?: Date | null;
  to?: Date | null;
  status?: 'active' | 'rolled_back' | 'all';
}) {
  const db = prismaClient as any;
  const page = Math.max(1, Math.floor(Number(params.page || 1)));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(params.pageSize || 50))));
  const q = str(params.q);
  const supplier = str(params.supplier);
  const item = str(params.item);
  const itemId = str(params.itemId);
  const status = params.status === 'rolled_back' || params.status === 'all' ? params.status : 'active';

  if (typeof db.stockNfImportAppliedChange?.findMany !== 'function') {
    return {
      rows: [],
      summary: {
        total: 0,
        active: 0,
        rolledBack: 0,
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
    where.rolledBackAt = null;
  } else if (status === 'rolled_back') {
    where.rolledBackAt = { not: null };
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

  if (supplier) {
    andClauses.push({
      supplierName: { contains: supplier, mode: 'insensitive' },
    });
  }

  if (item) {
    andClauses.push({
      OR: [
        { Item: { is: { name: { contains: item, mode: 'insensitive' } } } },
        { Line: { is: { ingredientName: { contains: item, mode: 'insensitive' } } } },
      ],
    });
  }

  if (q) {
    andClauses.push({
      OR: [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { supplierName: { contains: q, mode: 'insensitive' } },
        { Batch: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { Item: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { Line: { is: { ingredientName: { contains: q, mode: 'insensitive' } } } },
      ],
    });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  const [totalItems, rows, activeCount, rolledBackCount, uniqueItemsRows, uniqueSuppliersRows] = await Promise.all([
    db.stockNfImportAppliedChange.count({ where }),
    db.stockNfImportAppliedChange.findMany({
      where,
      orderBy: [{ movementAt: 'desc' }, { appliedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        batchId: true,
        lineId: true,
        itemId: true,
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
        rolledBackAt: true,
        rollbackStatus: true,
        rollbackMessage: true,
        metadata: true,
        Batch: {
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
        Line: {
          select: {
            rowNumber: true,
            ingredientName: true,
            qtyEntry: true,
            unitEntry: true,
            qtyConsumption: true,
            unitConsumption: true,
            costAmount: true,
            costTotalAmount: true,
          },
        },
      },
    }),
    db.stockNfImportAppliedChange.count({ where: { ...where, rolledBackAt: null } }),
    db.stockNfImportAppliedChange.count({ where: { ...where, rolledBackAt: { not: null } } }),
    db.stockNfImportAppliedChange.findMany({
      where,
      distinct: ['itemId'],
      select: { itemId: true },
    }),
    db.stockNfImportAppliedChange.findMany({
      where,
      distinct: ['supplierId', 'supplierName'],
      select: { supplierId: true, supplierName: true },
    }),
  ]);

  return {
    rows,
    summary: {
      total: totalItems,
      active: activeCount,
      rolledBack: rolledBackCount,
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
