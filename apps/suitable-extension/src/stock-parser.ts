export type PurchaseNote = {
  invoiceNumber: string;
  supplierName: string;
  date: string;
  total: number;
};
const text = (element: Element | null | undefined) =>
  (element?.textContent || "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
export function invoiceFromButton(button: Element): PurchaseNote | null {
  const row = button.closest("[data-index]");
  const cells = row?.firstElementChild?.children;
  if (
    !cells ||
    cells.length < 6 ||
    !["Lançar entrada", "Ver detalhes"].includes(text(button))
  )
    return null;
  const date = text(cells[3]).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!date || !/^\d+$/.test(text(cells[0]))) return null;
  return {
    invoiceNumber: text(cells[0]),
    supplierName: text(cells[1]),
    date: `${date[3]}-${date[2]}-${date[1]}`,
    total: money(text(cells[2])),
  };
}
export function money(raw: string) {
  const value = Number(
    raw
      .replace(/R\$|\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  );
  if (!Number.isFinite(value)) throw new Error("Valor inválido na nota");
  return value;
}
export function isProducts(dialog: Element) {
  return (
    !!Array.from(dialog.querySelectorAll("h6")).find(
      (node) => text(node) === "Fornecedor"
    ) &&
    dialog.textContent?.includes("Valor unitário") &&
    dialog.textContent?.includes("Identificador")
  );
}
export function productRows(dialog: Element) {
  return Array.from(dialog.querySelectorAll("[data-index]")).map((row) => {
    const cells = row.firstElementChild?.children;
    if (!cells || cells.length < 5)
      throw new Error("Não foi possível ler uma linha de produto");
    const quantity = text(cells[2].querySelector("p")).match(
      /^([\d.,]+)\s+(.+)$/
    );
    if (!quantity) throw new Error("Quantidade ou unidade não reconhecida");
    const number = quantity[1].includes(",")
      ? money(quantity[1])
      : Number(quantity[1]);
    return {
      index: row.getAttribute("data-index")!,
      ingredientName: text(cells[0]),
      qtyEntry: number,
      unitEntry: quantity[2],
      costAmount: money(text(cells[3])),
      costTotalAmount: money(text(cells[4])),
    };
  });
}
function searchField(dialog: Element) {
  const label = Array.from(dialog.querySelectorAll("label")).find(
    (node) => text(node) === "Buscar"
  );
  return (
    label?.parentElement?.querySelector<HTMLInputElement>("input") ||
    dialog.querySelector<HTMLInputElement>('input[placeholder="Buscar"]')
  );
}
/** Grey "Fornecedor" bar of the products tab; the import card goes right below it. */
export function supplierBar(dialog: Element): HTMLElement | null {
  const label = Array.from(dialog.querySelectorAll("h6")).find(
    (node) => text(node) === "Fornecedor"
  );
  const search = searchField(dialog);
  if (!label || !search) return null;
  for (
    let node: HTMLElement | null = label.parentElement;
    node && node !== dialog;
    node = node.parentElement
  )
    if (node.parentElement?.contains(search) && !node.contains(search))
      return node;
  return null;
}
const wait = () => new Promise((resolve) => setTimeout(resolve, 150));
export async function collectProducts(
  dialog: Element,
  note: PurchaseNote,
  options: { checkTotal?: boolean } = {}
) {
  if (!note.supplierName.trim())
    throw new Error(
      "Fornecedor da nota não identificado. Volte à lista e selecione a nota novamente"
    );
  const count = () =>
    text(
      Array.from(dialog.querySelectorAll("p")).find((node) =>
        text(node).startsWith("Mostrando ")
      )
    ).match(/Mostrando (\d+) resultados de (\d+) resultados/);
  const initial = count();
  if (!initial || Number(initial[2]) < 1 || Number(initial[2]) > 500)
    throw new Error("Confira a lista de produtos (máximo 500)");
  // A filter would silently omit products. Require the unfiltered invoice.
  const search = searchField(dialog);
  if (search?.value)
    throw new Error("Limpe a busca dos produtos antes de capturar a nota");
  const firstPage = dialog.querySelector<HTMLButtonElement>(
    'button[aria-label="page 1"]'
  );
  if (firstPage && firstPage.getAttribute("aria-current") !== "true") {
    firstPage.click();
    await wait();
  }
  const lines = [];
  for (let page = 0; page < 500; page++) {
    if (!dialog.isConnected || !isProducts(dialog))
      throw new Error("A janela da nota foi fechada ou alterada");
    const counts = count();
    if (!counts || counts[2] !== initial[2])
      throw new Error("A lista de produtos mudou durante a leitura");
    const expected = Math.min(
      Number(counts[1]),
      Number(initial[2]) - lines.length
    );
    const rows = new Map<string, ReturnType<typeof productRows>[number]>();
    const first = dialog.querySelector("[data-index]");
    let scroll: HTMLElement | null = first?.parentElement || null;
    while (
      scroll &&
      scroll !== dialog &&
      (scroll.scrollHeight <= scroll.clientHeight ||
        !["auto", "scroll"].includes(getComputedStyle(scroll).overflowY))
    )
      scroll = scroll.parentElement;
    if (scroll && scroll !== dialog) scroll.scrollTop = 0;
    await wait();
    for (let pass = 0; pass < 600; pass++) {
      for (const row of productRows(dialog)) rows.set(row.index, row);
      if (rows.size >= expected) break;
      if (
        !scroll ||
        scroll === dialog ||
        scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1
      )
        break;
      const previousTop = scroll.scrollTop;
      scroll.scrollTop += Math.max(40, scroll.clientHeight / 2);
      if (scroll.scrollTop === previousTop) break;
      await wait();
    }
    if (rows.size !== expected)
      throw new Error(
        "Não foi possível capturar todos os produtos. Nenhum lote foi criado"
      );
    lines.push(
      ...Array.from(rows.values())
        .sort((a, b) => Number(a.index) - Number(b.index))
        .map(({ index, ...line }) => line)
    );
    if (lines.length >= Number(initial[2])) break;
    const next = dialog.querySelector<HTMLButtonElement>(
      'button[aria-label="Go to next page"]'
    );
    if (!next || next.disabled)
      throw new Error("Há produtos em outra página que não puderam ser lidos");
    next.click();
    await wait();
  }
  if (lines.length !== Number(initial[2]))
    throw new Error("A contagem dos produtos não confere");
  const sum = lines.reduce((total, line) => total + line.costTotalAmount, 0);
  if (options.checkTotal && Math.abs(sum - note.total) > 0.02)
    throw new Error(
      "A soma dos produtos difere do total da nota. Confira filtros, frete ou itens removidos antes de criar o lote"
    );
  return { ...note, lines };
}
