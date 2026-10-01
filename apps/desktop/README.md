# Amodomio Desktop

Aplicativo genérico Amodomio em janela independente do navegador de delivery.
O início apresenta as funcionalidades; KDS é o primeiro módulo. Não há integração
nova com o sistema de delivery, banco local ou fila de alterações offline.

## Código compartilhado

O Electron empacota a exportação web de `../kds-mobile`. Login, início, componentes,
API e regras do KDS têm uma única implementação. Os arquivos `.web.ts(x)` separam
sessão, notificações e controles de janela; Android/iOS mantêm os adaptadores nativos.
Novos módulos devem entrar no início compartilhado. Recursos de desktop pertencem à
ponte restrita de `preload.cjs`; não exponha Node ou IPC genérico à interface.
A API existente mantém seus endpoints KDS, sem migrar dados nem permissões.

## Executar (Linux/macOS com nvm)

Em `apps/kds-mobile`:

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
O pacote `release/amodomio-desktop_1.0.0_amd64.deb` pode ser instalado com:

```bash
sudo apt install ./amodomio-desktop_1.0.0_amd64.deb
```

Abra **Amodomio** no menu de aplicativos, ou execute `amodomio` no terminal.
Para o backend rodando no mesmo Ubuntu, informe `http://localhost:3000` no login.
O servidor deve estar ativo. O pacote não inclui backend nem banco de dados.
Para desinstalar: `sudo apt remove amodomio-desktop`.
O sistema pode pedir acesso ao chaveiro para proteger a sessão.
