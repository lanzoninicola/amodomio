# Amodomio Desktop

Aplicativo genérico Amodomio em janela independente do navegador de delivery.
O início apresenta as funcionalidades; KDS é o primeiro módulo. Não há integração
nova com o sistema de delivery, banco local ou fila de alterações offline.

## Código compartilhado

O Electron empacota a exportação web de `../mobile`. Login, início, componentes,
API e regras do KDS têm uma única implementação. Os arquivos `.web.ts(x)` separam
sessão, notificações e controles de janela; Android/iOS mantêm os adaptadores nativos.
Novos módulos devem entrar no início compartilhado. Recursos de desktop pertencem à
ponte restrita de `preload.cjs`; não exponha Node ou IPC genérico à interface.
A API existente mantém seus endpoints KDS, sem migrar dados nem permissões.

## Executar (Linux/macOS com nvm)

Para gerar o instalador Windows a partir do Linux com nvm, execute
`npm run build:windows` na raiz do repositório ou em `apps/desktop`.
O comando ativa o Node de `apps/mobile/.nvmrc`, exporta a interface web e
empacota o instalador NSIS x64 em `apps/desktop/release/`.
As dependências de mobile e desktop devem estar instaladas.

Em `apps/mobile`:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use >/dev/null 2>&1; npm ci
```

Em `apps/desktop`:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use >/dev/null 2>&1; npm ci
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use >/dev/null 2>&1; npm start
```

No Windows, instale a versão Node indicada em `.nvmrc` e execute `npm ci` nas duas
pastas e `npm start` na pasta desktop, usando PowerShell.
A exportação ignora o `.env` de desenvolvimento. Informe a origem do servidor no
login (HTTPS em produção ou `http://IP-DA-REDE:3000` para teste LAN).
O backend deve estar acessível a partir do computador Windows.

## Instalador Windows

No Windows, em `apps/desktop`, execute `npm run dist:win`. O instalador NSIS `.exe`
será criado em `release/`. Outra opção é executar manualmente o workflow
“Instalador Amodomio Windows” e baixar o artefato `Amodomio-Windows-teste`.
O workflow só estará disponível depois de os arquivos estarem no GitHub.
Este instalador de teste não tem assinatura de código; o Windows pode exibir aviso.
Não há publicação automática nem atualizador configurado nesta versão.

## Comportamento

- Janela redimensionável com ícone próprio na barra de tarefas.
- “Compacto” posiciona uma janela estreita à direita; “Expandir” restaura o tamanho.
- “Sempre no topo” é opcional e começa desligado.
- O KDS continua consultando pedidos quando a janela perde foco; fechar o app encerra
  consultas e notificações. Notificações dependem das configurações do Windows.
- Sessão protegida pelo `safeStorage` do Electron. Se a criptografia do sistema não
  estiver disponível, o token permanece somente na memória até fechar o aplicativo.
- O cache de pedidos serve para consulta; alterações continuam exigindo conexão.

## Validação no Windows

Instalar e abrir ao lado do delivery; informar servidor e autenticar; abrir KDS;
receber um pedido com o delivery em foco; testar alteração de status; alternar
compacto/topo; fechar e reabrir para conferir sessão; sair e conferir remoção da sessão.
Testar também escala de tela de 125%/150% e monitor secundário. Exportar e empacotar
não substitui essa validação com Windows e servidor reais.

## Instalador Ubuntu (amd64)

Execute `npm run dist:linux` na pasta desktop com o Node de `.nvmrc` ativo.
O pacote `release/amodomio-desktop_1.0.2_amd64.deb` pode ser instalado com:

```bash
sudo apt install ./amodomio-desktop_1.0.2_amd64.deb
```

Abra **Amodomio** no menu de aplicativos, ou execute `amodomio` no terminal.
Para o backend rodando no mesmo Ubuntu, informe `http://localhost:3000` no login.
O servidor deve estar ativo. O pacote não inclui backend nem banco de dados.
Para desinstalar: `sudo apt remove amodomio-desktop`.
O sistema pode pedir acesso ao chaveiro para proteger a sessão.

## Widget e preferências do KDS (1.0.2)

Dentro do KDS, o ícone de widget alterna para uma janela de 360 × 300 e restaura o
formato anterior ao sair. Os pedidos continuam acessíveis por rolagem. Compacto e
Sempre no topo usam ícones com tooltip no mouse e no foco do teclado.
A engrenagem abre uma janela independente de configurações. Salvar aplica os status
imediatamente ao KDS e preserva a escolha local. Essa janela não recebe a ponte de
sessão/API do Electron. Validar no Ubuntu: alternar widget/compacto, voltar ao início,
abrir configurações duas vezes (uma única janela), salvar e reiniciar o app.

Os accordions começam fechados; os padrões visíveis continuam Aguardando forno e Assando.

### Envio dos instaladores ao Google Drive

O build local envia automaticamente o instalador para a mesma pasta da extensão:
https://drive.google.com/drive/folders/1Nj1uctv-kyEHECYeTqIKqTabKgXSEubR.
Requer o rclone com o remote `amodomio-drive`. As variáveis
`EXTENSION_DRIVE_REMOTE` e `EXTENSION_DRIVE_FOLDER_ID` alteram o destino,
assim como em `build:extension`. Cada envio recebe um nome com data para
preservar builds anteriores. Falhas no envio fazem o comando falhar, mantendo
o instalador local. Use `-- --no-upload` para gerar apenas localmente.

### Visualização Kanban do atendimento

Na engrenagem **Configurações do KDS → Visualização**, escolha **Lista atual**
ou **Kanban com tempo médio** e clique em **Salvar e fechar**. A preferência é
local ao computador e aplicada sem reiniciar; o Kanban é o padrão quando não há uma escolha salva.
Os filtros de status configurados continuam valendo para a lista atual.

O Kanban mantém Aguardando forno e Assando abertos lado a lado, com rolagem
independente e pedidos mais antigos primeiro. Mantém detalhes/status, aviso de
forno e WhatsApp. O círculo mostra a média entre entrada e finalização dos
pedidos finalizados do dia selecionado; não representa tempo restante nem inclui
trajeto de entrega. Sem finalizados válidos, mostra “Sem finalizados”. Em janelas
estreitas, o círculo fica acima das colunas. As animações respeitam movimento
reduzido; os alertas de atraso seguem as regras do mobile.

Prévia sem login e sem banco: abra `/?preview=kds` na exportação web. Exibe
pedidos fictícios; clicar no número avança o status apenas em memória, e
“Reiniciar prévia” restaura os exemplos. WhatsApp fica desativado.

### Cortar pizza

A tesoura ao lado do WhatsApp marca/desmarca **Cortar pizza** por pedido, nas
duas visualizações do Windows. A marcação é salva no servidor e compartilhada
com o KDS mobile. No mobile, ao mudar para **Assando** e novamente para
**Finalizado**, aparece o aviso amarelo **CORTAR PIZZA** com o número da comanda e
confirmação **Entendi**. O atalho de assar do alerta de forno também mostra o
aviso. Confirmar o aviso não remove a marcação; só a tesoura a remove.

Na prévia, o pedido #102 começa marcado. Clique no número para simular Assando,
confirme o aviso e clique novamente para simular Finalizado. Nada é persistido.
A sincronização real exige a migration `20261110021000_add_kds_requires_cut`
aplicada e atualização do servidor e dos clientes.
