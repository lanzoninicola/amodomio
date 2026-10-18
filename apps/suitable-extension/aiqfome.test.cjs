const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

// Synthetic DOM based on the screenshots; this is not captured aiqfome HTML.
for (const origin of ["header", "origin", "none"]) {
  test(`aiqfome screenshot reproduction: ${origin}`, () => {
    const directory = mkdtempSync(join(tmpdir(), "aiqfome-test-"));
    try {
      const parser = readFileSync(join(__dirname, "parser.js"), "utf8");
      const file = join(directory, "test.html");
      writeFileSync(
        file,
        `<!doctype html><body><div role="dialog">
        <h6>Detalhes do pedido ordem 1</h6>
        <p>15/10/26 18:09:28 - ${
          origin === "header" ? "Aiqfome → aiqfome" : "Suitable → Terminal"
        }</p>
        <section class="MuiPaper-root">
          <h6 class="MuiTypography-colorPrimary">Nome para chamar</h6><p>maiara renosto - aiqfome</p>
          <h6 class="MuiTypography-colorPrimary">Maiara Renosto</h6><p>(46) 99104-3114</p>
          <p>Bairro: Jardim Floresta</p><p>Cidade: PB</p>
        </section>
        <section class="MuiPaper-root"><div class="MuiGrid-container"><div><p>Origem</p></div><div><p>${
          origin === "origin" ? "aiqfome" : "Terminal"
        }</p></div></div></section>
        <section class="MuiPaper-root"><h6>Resumo de valores</h6>
          <div><div class="MuiGrid-container"><h6>1x</h6><p>Pizza (Aiq)</p><p>R$ 129,90</p></div>
            <p class="MuiTypography-body2">1x tamanho médio (Tamanhos)</p>
            <p class="MuiTypography-body2">1x da roça (Sabores)</p>
            <p class="MuiTypography-body2">1x mortazza (Sabores)</p>
          </div><div><h6>TOTAL</h6><h6>R$ 144,90</h6></div>
        </section></div><script>${parser}
        const order=SuitableKds.extractModal(document.querySelector('[role=dialog]'));
        document.body.dataset.result=JSON.stringify({order, validated:SuitableKds.validateItems(order.orderItems),
          sizes:['família','média','pequena','individual','fatia','desconhecido'].map(value=>SuitableKds.pizzaSize('1x tamanho '+value+' (Tamanhos)'))});
        </script>`
      );
      const chrome = spawnSync(
        process.env.CHROME_BIN || "/usr/bin/google-chrome",
        [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          `--user-data-dir=${join(directory, "profile")}`,
          "--dump-dom",
          `file://${file}`,
        ],
        { encoding: "utf8", timeout: 30000, maxBuffer: 5 * 1024 * 1024 }
      );
      assert.equal(chrome.status, 0, chrome.stderr);
      const match = chrome.stdout.match(/data-result="([^"]*)"/);
      assert.ok(match, chrome.stdout);
      const result = JSON.parse(
        match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")
      );
      assert.equal(result.order.customerName, "Maiara Renosto");
      assert.equal(result.order.customerPhone, "46991043114");
      assert.equal(
        result.order.channel,
        origin === "none" ? "CARDAPIO" : "AIQFOME"
      );
      assert.equal(result.order.orderAmount, 144.9);
      assert.equal(result.order.orderItems[0].size, "M");
      assert.deepEqual(result.order.orderItems[0].flavors, [
        "1x da roça",
        "1x mortazza",
      ]);
      assert.deepEqual(result.sizes, ["F", "M", "P", "I", "FT", null]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
