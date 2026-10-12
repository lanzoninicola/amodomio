# Suitable → Amodomio

A extensão adiciona **Adicionar ao KDS** no cabeçalho da modal **Detalhes do pedido**
do Suitable. Não adiciona botões aos cards do Kanban.

Ao clicar, abre uma revisão dentro da própria modal. Captura número e data do
pedido, nome e telefone do cliente, total e retirada, além de cada produto com
quantidade, tamanho, sabores e observações/adicionais presentes no resumo.
Os campos podem ser corrigidos antes do envio.

A versão 1.2.0 usa React e os componentes shadcn/ui do projeto, com visual claro
inspirado no Atendimento: resumo circular dos tamanhos, total formatado, cards
por produto e rodapé de envio sempre visível. Sabores ficam vinculados à pizza;
o resumo soma quantidades dos produtos. Observações vazias ficam recolhidas.
A revisão adapta os campos à largura disponível.

O React e o CSS são empacotados localmente em `content.js`, sem CDN. Todos os
controles ficam dentro de Shadow DOM fechado, com tema e reset próprios. O menu
shadcn de bairros usa um portal dentro do mesmo Shadow DOM, sem renderizar em
`document.body`. Os atalhos de teclado usados dentro
da revisão não propagam para o Suitable.

Para desenvolver a interface, edite `src/content.tsx` e `src/review.css`.
Na raiz do projeto, ative o Node da `.nvmrc` e execute:

```bash
npm run build:suitable-extension
npm run test:suitable-extension
```

O build localizado atualiza `content.js`, que já está incluído na pasta instalada.
Recarregue a extensão e a página do Suitable após atualizar os arquivos. Não é
necessário informar servidor e chave novamente se já estiverem salvos.

## Instalar no Windows (Chrome ou Edge)

1. Copie a pasta `apps/suitable-extension` para o Windows.
2. Abra `chrome://extensions` ou `edge://extensions`, ative **Modo do desenvolvedor**
   e escolha **Carregar sem compactação**, selecionando essa pasta.
3. Clique no ícone da extensão e abra **Globais**, mesmo sem o Suitable aberto.
4. Informe a origem do servidor Amodomio (ex.: `https://seu-servidor.com`) e
   a chave da API configurada no backend em `VITE_REST_API_SECRET_KEY`.
5. Clique em **Salvar configurações**. Servidor, chave e preferências são salvos
   neste navegador sem exigir uma aba ou permissão de site.
6. Abra o Suitable, reabra a extensão e clique em **Ativar na aba atual**, em Globais.
   Conceda acesso aos dois endereços. Abra os detalhes de um pedido para ver o botão.

A configuração persiste e a extensão acompanha a abertura de novas modais.
Na versão 1.1.1, o serviço de fundo salva os dados e termina a ativação mesmo
quando a janela de permissões fecha o popup. Ao atualizar os arquivos, recarregue
a extensão na lista de extensões para iniciar o serviço de fundo atualizado.
Se você já carregou a versão anterior, recarregue a extensão e a página do Suitable
para substituir o script que adicionava botões nos cards.

A chave fica no armazenamento local da extensão, acessível apenas aos contextos
internos da extensão; não é inserida no DOM nem disponibilizada aos scripts do
Suitable. A chave existente concede acesso à API REST do servidor. Para trocar
a chave/servidor, abra novamente a extensão. Não há credenciais no repositório.

## Pizzas e tamanhos

| Suitable           | KDS |
| ------------------ | --- |
| Família / Familiar | F   |
| Médio / Média      | M   |
| Pequeno / Pequena  | P   |
| Individual         | I   |
| Fatia / Fatias     | FT  |

A quantidade é a do produto principal, e os sabores permanecem vinculados àquela
pizza. Uma Família com três sabores continua sendo uma pizza Família.
Os textos dos sabores preservam os prefixos do Suitable (por exemplo, `1x` ou
`1/2`); esses prefixos não incrementam as contagens de pizzas do KDS.
Produtos sem tamanho de pizza, como bebidas, também ficam no registro importado.
Pizzas com tamanho desconhecido exigem correção na revisão antes do envio.
O total vem da linha **TOTAL**, incluindo descontos, e não da soma dos sabores.

## Backend, Atendimento e apps Windows/mobile

O envio usa `POST /api/kds/orders`, com canal `Suitable` e `orderItems` estruturado.
O backend valida os itens e calcula as contagens de tamanhos. Com pizzas e valor
maior que zero, cria o pedido em **Novo pedido**; ele aparece na cozinha Windows e
mobile pelo polling existente, usando o **mesmo servidor**. No Windows, habilite
**Novo pedido** nas configurações de status e expanda a coluna para visualizar
os pedidos desse status. Pedidos sem pizzas ou com valor zero ficam pendentes
no Atendimento.

Nome, telefone e itens aparecem na modal de detalhes dos apps Windows/mobile.
Os itens também aparecem nos detalhes do **Atendimento** em
`/admin/kds/atendimento`. São uma cópia dos dados importados; editar posteriormente
as contagens no Atendimento não reescreve essa cópia original.

A extensão não modifica o pedido no Suitable nem cria sabores no cadastro do
Cardápio. Uma comanda reservada pelo Atendimento pode ser preenchida somente
quando está pendente e sem dados de pedido, cliente, pagamento ou produção.
Nesse caso, preserva ID e posição da linha. Se já houver pedido ou dados na comanda,
o servidor recusa o envio e não sobrescreve nada.

A extensão roda no navegador que abre o Suitable. Os apps Electron e Android/iOS
recebem o pedido pelo backend; a extensão não é instalada dentro deles.

## Atualização do servidor e dos apps

Esta versão adiciona a coluna opcional JSONB `order_items` em
`kds_daily_order_details`, com a migração:

`prisma/migrations/20261011010000_kds_order_items/migration.sql`

A migração preserva os dados existentes e precisa ser aplicada ao ambiente de
destino antes de executar o backend atualizado. Use o processo de deploy do
projeto para aplicar as migrações e gerar o Prisma Client. Não há backfill.
Os apps precisam receber a nova versão para exibir sabores/telefone na modal;
apenas apontar um binário antigo ao backend não adiciona os novos campos à tela.

## Verificações

Na raiz do repositório, ative o Node indicado na `.nvmrc`:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1
nvm use >/dev/null 2>&1
npm run test:suitable-extension
npx vitest run app/routes/api.kds.orders.import.test.ts app/routes/api.kds.orders.voice.test.ts apps/mobile/src/kds/orders.test.ts
```

O teste de DOM precisa do Chrome local (`/usr/bin/google-chrome`), ou da variável
`CHROME_BIN` apontando ao executável. Usa o trecho real da modal fornecido pelo
usuário em `fixtures/suitable-order-modal.html`: confere botão apenas na modal,
captura, associação de sabores, revisão/envio e troca do pedido aberto.

A detecção usa estrutura Material UI e textos sem depender das classes `jss`
numeradas. Mudanças estruturais do Suitable podem exigir atualização.
O teste de DOM simula a comunicação da extensão. A instalação efetiva no
Chrome/Edge, o envio ao servidor de destino e os binários instalados Windows e
Android/iOS precisam de validação nesses ambientes.

## Entrega e sabores no servidor (1.2.1)

A revisão não mostra o campo de nome do produto. O nome original continua no
snapshot, preservando a identificação interna do item e a validação de pizzas.

Para entregas, captura `Bairro:`, `Cidade:` e a linha `Taxa de entrega` do Suitable.
Carrega os bairros existentes por `GET /api/kds/delivery-zones`. Uma correspondência
única por nome (ignorando acentos e caixa) é pré-selecionada; nomes duplicados
exigem cidade correspondente ou seleção manual. Não cria bairros automaticamente.
A lista permanece dentro do Shadow DOM. Em falha de leitura, permite tentar novamente.
Bairro e taxa válidos são obrigatórios para enviar uma entrega.

A criação usa os campos existentes `deliveryZoneId`, `hasMoto: true` e `motoValue`.
O `orderAmount` mantém o TOTAL do Suitable, que já inclui a taxa; não soma a taxa
novamente. Em retirada, envia `hasMoto: false`, `motoValue: 0`, sem bairro.
Não requer uma nova migração além da migração de `orderItems` já prevista.

Os sabores são persistidos em `orderItems` (JSONB `order_items`), numa lista de
textos por pizza, junto com quantidade, tamanho e observações. O servidor pode
consultar e processar esse JSON e a API o retorna nos pedidos. Os prefixos `1x`
e frações permanecem no texto original: não existem ainda IDs de sabores nem
campos próprios de fração. Vincular ao Cardápio, calcular consumo de ingredientes
ou agrupar sabores com nomes diferentes exigirá um mapeamento explícito futuro.

## Regras da importação no servidor (1.2.2)

O fluxo com `orderItems` tem validação própria no servidor. Comanda deve ser
inteira positiva, data deve existir no calendário e valores devem ser finitos,
não negativos, com até duas casas decimais e dentro do limite do banco.
Entrega exige bairro cadastrado e taxa não superior ao total; retirada exige
bairro vazio e taxa zero. Essas regras não dependem da extensão.

A data deve ter um dia já registrado no Atendimento. Dias ainda pendentes não
são abertos pela importação. Um dia **fechado** é automaticamente **reaberto**
(`REOPENED`) quando a importação é concluída com sucesso, conforme a preferência
operacional definida. A reabertura preserva as datas do fechamento anterior,
como a ação existente do Atendimento. Não reenvia relatórios ou mensagens.

Usa a mesma leitura de estoque do Atendimento, incluindo ajustes/perdas e modo
saldo atual. Se existir estoque cadastrado, compara as quantidades solicitadas
com o saldo efetivo menos os tamanhos das comandas do dia. Sabores não aumentam
as contagens. Sem estoque cadastrado, preserva a regra atual do Atendimento,
que não impede a gravação. Não altera o registro de estoque: os pedidos passam
a compor a utilização das massas.

Validação de estoque, preenchimento de reserva/criação, recálculo financeiro e
reabertura ficam numa transação. Importações do mesmo dia são serializadas por
bloqueio do cabeçalho e das linhas existentes. Isso protege importações entre si;
a tela de Atendimento mantém seu fluxo atual de edição, fora dessa transação.
Uma falha de gravação desfaz tanto o pedido quanto a reabertura. A API antiga,
sem `orderItems`, conserva seu contrato e seu comportamento de abertura.

Para verificar concorrência e rollback em PostgreSQL **temporário e isolado**:

```bash
npm run test:suitable-import-db
```

Requer binários PostgreSQL 18 em `/usr/lib/postgresql/18/bin`, ou `POSTGRES_BIN`
apontando para o diretório equivalente. Não usa URLs dos bancos do projeto.
O teste cria um cluster em `/tmp`, usa somente socket local e o remove ao concluir.

## Consulta antes do envio (1.2.3)

A revisão inicia recolhida, com cliente e telefone no cabeçalho. Mostrar detalhes
abre os campos do pedido sem perder alterações. A extensão consulta
POST /api/kds/orders/check ao abrir e ao alterar data, comanda ou itens; Consultar
servidor atualiza manualmente. Essa API autenticada é somente leitura.

Comanda ocupada (mesma data e número, de qualquer canal), massa insuficiente
ou dia não iniciado bloqueiam o envio. Reserva vazia continua disponível.
Sem estoque cadastrado, mostra que o saldo não foi verificado e mantém a regra
atual de permitir envio. A consulta não reserva massas; o servidor repete as
validações na transação do envio. Para usar esta versão, publique também a nova
rota no servidor antes de recarregar a extensão.


## Configurações por área (1.3.0)

A extensão tem nome e conexão genéricos: Suitable → Amodomio. A tela Globais
centraliza servidor, chave e site vinculado. A tela KDS permite habilitar/desabilitar
essa integração. Salvar e ativar são ações separadas; abrir o popup não ativa a aba.

Servidor/chave/site existentes continuam nas mesmas chaves do armazenamento local,
preservando instalações anteriores. As preferências de cada integração usam
`modules.<area>`, inicialmente `modules.kds.enabled`, com versão de configuração 2.
O serviço preserva os demais módulos ao salvar o KDS. Desabilitar remove a
inscrição dos scripts KDS, avisa abas já abertas e impede chamadas KDS no serviço.
Ao habilitar novamente, use Ativar na aba atual para registrar os scripts.
Futuras áreas podem compartilhar a conexão sem misturar suas preferências com o KDS.

Os dados ficam neste perfil do navegador, não no servidor ou em outros dispositivos.

## Cabeçalho compacto e Inter (1.3.1)

Cliente e telefone aparecem como texto editável ao clicar ou focar pelo teclado.
O total fica no final da primeira linha; Mostrar detalhes tem ícone e fica à direita
dos tamanhos. Atualizar comanda e estoque repete apenas a consulta, sem criar pedido.
A fonte Inter acompanha a extensão: arquivos locais no popup e FontFace com dados
binários na revisão, sem depender de CDN ou da política de fontes do Suitable.
