import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Render at build time so the popup keeps its existing DOM-based controller.
function Popup() {
  return (
    <>
      <header>
        <Button type="button" id="back" variant="link" className="back" hidden>
          ← Voltar
        </Button>
        <h1 id="title">Integração Suitable</h1>
      </header>
      <form id="config">
        <nav aria-label="Configurações">
          <Button
            type="button"
            id="global-tab"
            variant="outline"
            aria-controls="global-panel"
          >
            <span>Configurações globais</span>
            <span aria-hidden="true">›</span>
          </Button>
          <Button
            type="button"
            id="kds-tab"
            variant="outline"
            aria-controls="kds-panel"
          >
            <span>KDS</span>
            <span aria-hidden="true">›</span>
          </Button>
          <Button
            type="button"
            id="stock-tab"
            variant="outline"
            aria-controls="stock-panel"
          >
            <span>Entrada de NFs</span>
            <span aria-hidden="true">›</span>
          </Button>
        </nav>
        <section id="global-panel" aria-labelledby="title" hidden>
          <h2>Conexão com o Amodomio</h2>
          <label>
            URL do servidor Amodomio
            <Input
              id="server"
              type="url"
              placeholder="https://seu-servidor.com"
              required
            />
          </label>
          <label>
            Chave da API
            <Input id="key" type="password" required autoComplete="off" />
          </label>
          <div className="connection">
            <h2>Site do Suitable</h2>
            <p id="site">Nenhum site vinculado.</p>
            <Button
              type="button"
              id="activate"
              variant="outline"
              className="w-full"
            >
              Ativar na aba atual
            </Button>
            <p>
              Abra o Suitable e clique para vincular o site e permitir acesso.
              Você pode salvar sem abrir o Suitable.
            </p>
          </div>
        </section>
        <section id="kds-panel" aria-labelledby="title" hidden>
          <h2>Pedidos → KDS</h2>
          <label className="toggle">
            <input id="kds-enabled" type="checkbox" defaultChecked />
            <span>Habilitar integração com o KDS</span>
          </label>
          <p>
            Adiciona o botão nos detalhes dos pedidos para revisar cliente,
            telefone, pizzas, sabores e entrega.
          </p>
          <div className="info">
            Antes do envio, consulta a comanda e o estoque de massas no
            Amodomio.
          </div>
          <p>As demais configurações de conexão ficam em Globais.</p>
        </section>
        <section id="stock-panel" aria-labelledby="title" hidden>
          <h2>Notas de compra → Estoque</h2>
          <label className="toggle">
            <input id="stock-enabled" type="checkbox" defaultChecked />
            <span>Habilitar entrada de NFs no estoque</span>
          </label>
          <p>
            Adiciona a revisão de produtos nas notas de compra para lançar a
            entrada no estoque do Amodomio.
          </p>
          <label className="toggle">
            <input id="stock-check-total" type="checkbox" />
            <span>Conferir soma dos produtos com o total da nota</span>
          </label>
          <p>
            Desligado por padrão. Quando ligado, bloqueia a criação do lote se a
            soma dos produtos diferir do total da nota (filtros, frete ou itens
            removidos).
          </p>
          <label className="toggle">
            <input id="stock-block-accounts" type="checkbox" defaultChecked />
            <span>Bloquear Contas até confirmar o envio da nota</span>
          </label>
          <p>
            Ligado por padrão. Desative e salve para continuar o lançamento se
            houver uma falha na extensão ou na integração.
          </p>
          <p>As demais configurações de conexão ficam em Globais.</p>
        </section>
        <footer hidden>
          <Button id="save" type="submit" className="w-full">
            Salvar configurações
          </Button>
          <p id="status" role="status" aria-live="polite" />
        </footer>
      </form>
    </>
  );
}

process.stdout.write(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Suitable → Amodomio</title>
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>${renderToStaticMarkup(<Popup />)}
    <script src="popup.js"></script>
  </body>
</html>
`);
