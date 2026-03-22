export const STOCK_PHOTO_CHATGPT_SETTINGS_CONTEXT = "stock-photo-chatgpt";
export const STOCK_PHOTO_CHATGPT_PROMPT_SETTING_NAME = "assistente.prompt";
export const STOCK_PHOTO_CHATGPT_RETURN_URL_SETTING_NAME = "assistente.return-url";

export const DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL =
  "https://www.amodomio.com.br/admin/mobile/entrada-estoque-foto";

export const DEFAULT_STOCK_PHOTO_CHATGPT_PROMPT_TEMPLATE = [
  "Voce esta lendo foto de cupom fiscal ou nota fiscal de entrada de estoque para o sistema Amodomio.",
  "Analise as imagens que vou anexar nesta conversa.",
  "Responda somente com um bloco ```json``` valido, sem texto antes ou depois.",
  "Extraia TODAS as linhas de produto visiveis no documento, na mesma ordem em que aparecem.",
  "Nao filtre itens por tipo, categoria, uso culinario, relevancia ou se parecem estoque.",
  "Inclua alimentos, bebidas, limpeza, descartaveis, utilidades e qualquer outro item de produto que apareca no cupom.",
  "Se o mesmo item aparecer repetido em linhas diferentes, mantenha repetido em lines.",
  "So ignore linhas que claramente nao sao produto, como subtotal, desconto, troco, taxa, pagamento e resumo fiscal.",
  "Prefira excesso de linhas a falta de linhas.",
  "Se estiver em duvida se uma linha e produto ou nao, inclua a linha.",
  "Seu papel aqui e transcrever o documento com fidelidade, nao resumir, interpretar ou curar os itens.",
  "Nao invente linhas e nao descarte linhas legiveis.",
  "Nao estime quantidades ilegiveis e nao mapeie nomes para o sistema interno.",
  "Copie o nome do ingrediente/produto o mais proximo possivel do documento.",
  "Use ponto para decimais no JSON.",
  "movementAt deve ser a data da entrada ou emissao da NF em formato YYYY-MM-DD quando visivel.",
  "invoiceNumber deve conter somente o numero identificado da NF/cupom quando visivel.",
  "supplierName e supplierCnpj devem ficar no objeto document e podem ser repetidos por linha apenas se necessario.",
  "metadata.returnUrl deve repetir exatamente a URL informada abaixo para facilitar voltar para esta ferramenta.",
  "qtyEntry e costAmount devem ser numericos.",
  "costAmount significa custo unitario por unitEntry.",
  "costTotalAmount significa total da linha quando visivel; se nao estiver claro, use null.",
  "Se uma informacao nao estiver legivel, use null.",
  "Nao inclua chaves extras.",
  "FORNECEDOR_REFERENCIA: priorize {{supplierName}}{{supplierCnpjLabel}} ao preencher document.supplierName e document.supplierCnpj.",
  "RETURN_URL_REFERENCIA: {{returnUrl}}",
  "",
  "FORMATO_OBRIGATORIO_DA_RESPOSTA",
  JSON.stringify(
    {
      metadata: {
        returnUrl: "{{returnUrl}}",
      },
      document: {
        supplierName: "{{supplierName}}",
        supplierCnpj: "{{supplierCnpj}}",
        invoiceNumber: "12345",
        movementAt: "2026-03-21",
        notes: "observacoes curtas opcionais",
      },
      lines: [
        {
          rowNumber: 1,
          ingredientName: "MUSSARELA",
          qtyEntry: 4,
          unitEntry: "KG",
          costAmount: 42.5,
          costTotalAmount: 170,
          observation: "campo opcional",
        },
      ],
    },
    null,
    2,
  ),
].join("\n");
