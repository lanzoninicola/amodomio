(() => {
  const clean = (value) => value.replace(/\s+/g, " ").trim();
  const text = (element) => clean(element.textContent);
  function pizzaSize(name) {
    const normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/^PIZZAS?\s*/, "")
      .trim();
    const sizes = {
      FAMILIA: "F",
      FAMILIAR: "F",
      MEDIO: "M",
      MEDIA: "M",
      PEQUENO: "P",
      PEQUENA: "P",
      INDIVIDUAL: "I",
      FATIA: "FT",
      FATIAS: "FT",
      F: "F",
      M: "M",
      P: "P",
      I: "I",
      FT: "FT",
    };
    return sizes[normalized] ?? null;
  }
  function extractModal(dialog) {
    const heading = [...dialog.querySelectorAll("h6")].find((el) =>
      /^Detalhes do pedido ordem\s+\d+$/i.test(text(el))
    );
    if (!heading) return null;
    const summaryHeading = [...dialog.querySelectorAll("h6")].find(
      (el) => text(el) === "Resumo de valores"
    );
    const summary = summaryHeading?.closest(".MuiPaper-root");
    if (!summary) return null;
    const phoneElement = [...dialog.querySelectorAll("p")].find((el) =>
      /^(?:\+55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}$/.test(text(el))
    );
    const customerPanel = phoneElement?.closest(".MuiPaper-root");
    const customer = customerPanel?.querySelector(
      "h6.MuiTypography-colorPrimary"
    );
    const totalHeading = [...summary.querySelectorAll("h6")].find(
      (el) => text(el) === "TOTAL"
    );
    const totalText =
      totalHeading?.parentElement &&
      [...totalHeading.parentElement.querySelectorAll("h6")]
        .map(text)
        .find((value) => /^R\$/.test(value));
    const items = [];
    for (const quantityHeading of summary.querySelectorAll("h6")) {
      const quantityMatch = text(quantityHeading).match(/^(\d+)\s*x$/i);
      if (!quantityMatch) continue;
      const row = quantityHeading.closest(".MuiGrid-container");
      const itemRoot = row?.parentElement;
      const product =
        row &&
        [...row.querySelectorAll("p")].find((el) => !/^R\$/.test(text(el)));
      if (!product || !itemRoot) continue;
      const details = [...itemRoot.querySelectorAll("p.MuiTypography-body2")]
        .map(text)
        .filter((value) => value && !/^R\$/.test(value));
      const name = text(product);
      items.push({
        name,
        quantity: Number(quantityMatch[1]),
        size: /\bpizzas?\b/i.test(name) ? pizzaSize(name) : null,
        flavors: details
          .filter((value) => /\(Sabores\)\s*$/i.test(value))
          .map((value) => value.replace(/\s*\(Sabores\)\s*$/i, "").trim()),
        notes: details.filter((value) => !/\(Sabores\)\s*$/i.test(value)),
      });
    }
    const dateMatch = [...dialog.querySelectorAll("p")]
      .map(text)
      .find((value) => /^\d{2}\/\d{2}\/\d{2,4}\s+\d{2}:\d{2}/.test(value))
      ?.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);
    const takeAway = [...dialog.querySelectorAll("p")].some(
      (el) => text(el) === "Retirada"
    );
    const addressLine = (prefix) =>
      [...dialog.querySelectorAll("p")]
        .map(text)
        .find((value) => value.startsWith(`${prefix}:`))
        ?.slice(prefix.length + 1)
        .trim() || "";
    const feeLabel = [...summary.querySelectorAll("p")].find((el) =>
      /^Taxa de entrega$/i.test(text(el))
    );
    const feeText =
      feeLabel?.parentElement?.parentElement &&
      [...feeLabel.parentElement.parentElement.querySelectorAll("p")]
        .map(text)
        .find((value) => /^R\$/.test(value));
    const now = new Date();
    const date = dateMatch
      ? `${dateMatch[3].length === 2 ? "20" : ""}${dateMatch[3]}-${
          dateMatch[2]
        }-${dateMatch[1]}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(now.getDate()).padStart(2, "0")}`;
    return {
      commandNumber: Number(text(heading).match(/\d+$/)[0]),
      date,
      customerName: customer ? text(customer) : "",
      customerPhone: phoneElement ? text(phoneElement).replace(/\D/g, "") : "",
      orderAmount: totalText
        ? Number(totalText.replace(/[^\d,]/g, "").replace(",", "."))
        : null,
      takeAway,
      deliveryNeighborhood: takeAway ? "" : addressLine("Bairro"),
      deliveryCity: takeAway ? "" : addressLine("Cidade"),
      deliveryFee: takeAway
        ? 0
        : feeText
        ? Number(feeText.replace(/[^\d,]/g, "").replace(",", "."))
        : null,
      orderItems: items,
    };
  }
  function validateItems(items) {
    if (!Array.isArray(items) || !items.length || items.length > 100)
      throw new Error("Confira os itens do pedido (1 a 100 itens).");
    return items.map((item) => {
      if (
        !item ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        item.name.length > 300 ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 1000
      )
        throw new Error("Confira produto e quantidade de cada item.");
      if (item.size !== null && !["F", "M", "P", "I", "FT"].includes(item.size))
        throw new Error("Tamanho inválido. Use F, M, P, I ou FT.");
      if (/\bpizzas?\b/i.test(item.name) && !item.size)
        throw new Error("Informe o tamanho de todas as pizzas.");
      for (const field of ["flavors", "notes"]) {
        if (
          !Array.isArray(item[field]) ||
          item[field].length > 100 ||
          item[field].some(
            (line) =>
              typeof line !== "string" || !line.trim() || line.length > 1000
          )
        )
          throw new Error("Confira sabores e observações dos itens.");
      }
      return {
        name: item.name.trim(),
        quantity: item.quantity,
        size: item.size,
        flavors: item.flavors.map((line) => line.trim()),
        notes: item.notes.map((line) => line.trim()),
      };
    });
  }
  globalThis.SuitableKds = { extractModal, pizzaSize, validateItems };
})();
