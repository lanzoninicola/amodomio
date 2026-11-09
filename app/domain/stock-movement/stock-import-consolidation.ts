import { createHash } from "node:crypto";

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function fingerprintsForAppliedDuplicateCheck(
  lines: any[]
): Array<{ sourceFingerprint: string }> {
  return lines.flatMap((line) =>
    [
      ...new Set<string>(
        [
          line.sourceFingerprint,
          line.metadata?.consolidation?.originalFingerprint,
          ...(line.metadata?.consolidation?.originalFingerprints || []),
        ].filter(Boolean)
      ),
    ].map((sourceFingerprint) => ({ sourceFingerprint }))
  );
}

export function appliedFingerprintWhere(fingerprints: string[]) {
  return {
    OR: [
      { sourceFingerprint: { in: fingerprints } },
      ...fingerprints.flatMap((fingerprint) => [
        {
          metadata: {
            path: ["consolidation", "originalFingerprint"],
            equals: fingerprint,
          },
        },
        {
          metadata: {
            path: ["consolidation", "originalFingerprints"],
            array_contains: [fingerprint],
          },
        },
      ]),
    ],
  };
}

/** Group source descriptions before mapping; never use the linked item as identity. */
export function consolidateSupplierBatchLines(lines: any[]) {
  const groups = new Map<string, any[]>();
  for (const [index, line] of lines.entries()) {
    const quantity = Number(line.qtyEntry);
    const total =
      line.costTotalAmount == null
        ? quantity * Number(line.costAmount)
        : Number(line.costTotalAmount);
    // Invalid input must remain visible for review instead of being absorbed.
    const canGroup =
      normalize(line.ingredientName) &&
      line.invoiceNumber &&
      line.movementAt &&
      normalize(line.unitEntry) &&
      quantity > 0 &&
      Number.isFinite(quantity) &&
      total > 0 &&
      Number.isFinite(total) &&
      Number(line.costAmount) > 0;
    const key = canGroup
      ? JSON.stringify([
          normalize(line.ingredientName),
          normalize(line.invoiceNumber),
          line.supplierId ||
            normalize(line.supplierCnpj).replace(/\D/g, "") ||
            normalize(line.supplierName),
          new Date(line.movementAt).toISOString(),
          normalize(line.unitEntry),
          normalize(line.unitConsumption),
          normalize(line.movementUnit),
          normalize(line.motivo),
        ])
      : `ungrouped:${index}`;
    const group = groups.get(key) || [];
    group.push(line);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const first = group[0];
    if (group.length === 1) return first;
    const qtyEntry = group.reduce(
      (sum, line) => sum + Number(line.qtyEntry),
      0
    );
    const costTotalAmount = Number(
      group
        .reduce(
          (sum, line) =>
            sum +
            (line.costTotalAmount == null
              ? Number(line.qtyEntry) * Number(line.costAmount)
              : Number(line.costTotalAmount)),
          0
        )
        .toFixed(8)
    );
    const fingerprints = group.map((line) => line.sourceFingerprint).sort();
    const unique = [...new Set(fingerprints)];
    // Retain the old fingerprint for identical repeated lines across deployments.
    const sourceFingerprint =
      unique.length === 1
        ? hash({
            originalFingerprint: unique[0],
            occurrenceCount: group.length,
          })
        : hash({ originalFingerprints: fingerprints });
    const originalFingerprints = fingerprintsForAppliedDuplicateCheck(
      group
    ).map((line) => line.sourceFingerprint);
    // Also recognize groups previously imported by the exact-duplicate algorithm.
    for (const fingerprint of unique) {
      const count = fingerprints.filter(
        (value) => value === fingerprint
      ).length;
      if (count > 1)
        originalFingerprints.push(
          hash({ originalFingerprint: fingerprint, occurrenceCount: count })
        );
    }
    const consolidation = {
      occurrenceCount: group.length,
      rowNumbers: group.map((line) => line.rowNumber),
      originalFingerprint: first.sourceFingerprint,
      originalFingerprints: [...new Set(originalFingerprints)],
    };
    return {
      ...first,
      qtyEntry,
      costTotalAmount,
      costAmount: costTotalAmount / qtyEntry,
      qtyConsumption: group.every((line) => line.qtyConsumption == null)
        ? null
        : group.reduce(
            (sum, line) => sum + Number(line.qtyConsumption ?? 0),
            0
          ),
      sourceFingerprint,
      metadata: { ...(first.metadata || {}), consolidation },
      rawData: {
        primary: first.rawData,
        consolidatedLines: group.map((line) => line.rawData),
        consolidation,
      },
    };
  });
}
