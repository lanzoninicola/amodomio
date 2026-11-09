# Pizza Flavor Wizard

Este documento define os requisitos do fluxo guiado para cadastro rapido de um sabor de pizza no admin.

## Objetivo

Criar uma abstracao de UI orientada a tarefa real do operador:

- o usuario pensa em "novo sabor de pizza";
- o sistema executa por baixo a criacao e configuracao de `Item`, `ItemVariation`, `Recipe` e `ItemCostSheet`;
- a UX deve reduzir ruido tecnico e concentrar apenas os dados minimos necessarios para comecar.

## Problema que o fluxo resolve

O fluxo tecnico atual exige conhecimento operacional de varias entidades:

- `Item`
- `Recipe`
- `ItemCostSheet`
- variacoes
- referencia de variacao

Isso aumenta friccao para usuarios com pouca familiaridade com o sistema. O wizard deve esconder essa complexidade e transformar o processo em um passo a passo curto, claro e guiado.

## Posicionamento no produto

### Entrada de menu

Deve existir uma entrada de menu especifica, em linguagem natural:

- nome recomendado: `Novo sabor de pizza`

Rotulos tecnicos como `Novo item`, `Receitas` ou `Fichas tecnicas` nao devem ser a porta de entrada principal deste fluxo.

### Linguagem

A interface deve usar linguagem orientada a tarefa, nao ao modelo interno do sistema.

Preferir:

- `Novo sabor`
- `Montar receita`
- `Validar custo`
- `Finalizar`

Evitar como labels primarios:

- `Item`
- `Vincular receita`
- `Ficha tecnica`
- `Variacao de referencia`

## Forma da experiencia

### Container principal

O fluxo deve abrir em uma modal full screen.

Requisitos:

- remover ruido visual do restante do admin;
- isolar o usuario em uma tarefa unica;
- suportar desktop e mobile;
- funcionar como experiencia mobile-first.

### Mobile-first

Este fluxo deve nascer adequado para uso em celular.

Requisitos:

- ocupar a tela inteira no mobile;
- uma etapa por vez;
- header fixo com progresso visivel;
- rodape fixo com acoes principais;
- elementos grandes o suficiente para toque;
- evitar tabelas, grids densos e comparacoes lado a lado;
- evitar depender de hover;
- ajuda contextual deve abrir em `sheet`, `popover` ou bloco legivel no mobile, nunca tooltip pequeno apenas com hover.

## Estrutura de etapas

O wizard deve transmitir progressao com clareza. Sem isso, a experiencia vira um formulario longo sem previsibilidade.

### Indicadores obrigatorios de progresso

O header da modal deve ter:

- titulo do fluxo: `Novo sabor de pizza`;
- texto do tipo `Etapa X de 4`;
- barra de progresso;
- nome da etapa atual;
- feedback visual de etapas concluidas.

Estados visuais minimos:

- `pendente`
- `atual`
- `concluida`

### Etapas obrigatorias

#### 1. Novo sabor

Objetivo: capturar somente o essencial.

Campos:

- `Nome do sabor`
- `Ingredientes`

Observacoes:

- `Ingredientes` aceita texto livre em linguagem natural;
- exemplos podem usar lista separada por virgulas e `e`;
- categoria nao aparece;
- descricao curta nao aparece;
- observacoes importantes nao aparecem.

Microcopy recomendada:

- titulo: `Qual e o novo sabor?`
- apoio: `Digite o nome e liste os ingredientes do jeito que voce montaria essa pizza.`

#### 2. Montar receita

Objetivo: transformar a descricao do operador em composicao tecnica inicial.

Requisitos:

- reutilizar o componente de assistente ja usado na aba de receita do item;
- o assistente e parte central do fluxo, nao um extra lateral;
- o usuario deve conseguir revisar e ajustar a sugestao antes de seguir.

Integracao esperada:

- reaproveitar a logica existente em componentes como `item-recipe-chatgpt-assistant-panel.tsx` e/ou `recipe-chatgpt-assistant-panel.tsx`;
- usar o assistente para estruturar ingredientes, quantidades e faltas de cadastro;
- manter compatibilidade com o catalogo de ingredientes ja existente.

Microcopy recomendada:

- titulo: `Vamos montar a receita`
- apoio: `O assistente organiza sua ideia em uma receita inicial.`

#### 3. Validar custo

Objetivo: exibir o resultado tecnico ja traduzido para decisao operacional.

Requisitos:

- mostrar receita consolidada;
- mostrar ficha tecnica base;
- mostrar custo estimado;
- destacar pendencias como ingredientes ausentes, itens sem custo ou inconsistencias relevantes;
- privilegiar cards e blocos curtos no mobile.

Microcopy recomendada:

- titulo: `Custo e ficha tecnica`
- apoio: `Confira os ingredientes, ajuste o que for preciso e valide o custo.`

#### 4. Finalizar

Objetivo: revisar e confirmar a criacao.

Requisitos:

- mostrar resumo final do sabor;
- confirmar nome, ingredientes interpretados e custo estimado;
- deixar claro o que sera criado por baixo;
- oferecer confirmacao final com acao unica.

Microcopy recomendada:

- titulo: `Revisao final`
- apoio: `Se estiver tudo certo, criamos o sabor com a estrutura necessaria.`

## Regras automaticas de dominio

Para este fluxo, certas decisoes devem ser convencao do sistema, nao escolha de formulario.

### Categoria

O sabor deve nascer com categoria padrao:

- `sabor nostrano`

Regra:

- esta categoria nao precisa ficar visivel na UI guiada;
- a definicao deve acontecer automaticamente em backend ou no passo final de persistencia.

### Variacoes

Todo sabor de pizza criado por este fluxo deve nascer com o conjunto padrao de variacoes do produto.

Variacoes basicas esperadas:

- `pizza-bigger`
- `pizza-individual`
- `pizza-medium`
- `pizza-small`

Regra de referencia:

- `pizza-medium` deve ser marcada automaticamente como variacao de referencia.

Implicacoes:

- a tela guiada nao deve expor seletor manual de referencia em condicao normal;
- a estrutura de variacoes e uma regra do dominio para sabor de pizza;
- configuracao tecnica manual continua podendo existir fora do wizard para excecoes.

## Ajuda contextual

Deve existir um ponto de interrogacao no header da modal.

Requisitos:

- posicionado ao lado do titulo principal;
- discreto, mas sempre acessivel;
- no mobile, abrir ajuda em formato legivel;
- explicar o proposito da funcionalidade em linguagem nao tecnica.

Texto base recomendado:

`Este fluxo simplifica o cadastro de um sabor de pizza. Voce informa o essencial, o assistente ajuda com a receita, e o sistema monta a estrutura tecnica e o custo por baixo. A variacao media e usada como referencia para o calculo das demais.`

## Requisitos de UX

### Clareza

A experiencia deve sempre deixar claro:

- onde o usuario esta;
- quanto falta para terminar;
- o que o sistema esta fazendo por baixo;
- o que ainda precisa de revisao manual.

### Baixa carga cognitiva

O fluxo deve:

- pedir somente o minimo necessario em cada etapa;
- preservar dados ao avancar e voltar;
- evitar termos internos do dominio na camada principal;
- agrupar decisoes tecnicas em momentos de revisao, nao na entrada do dado bruto.

### Progressao percebida

Cada etapa concluida deve devolver feedback curto, por exemplo:

- `Sabor definido`
- `Receita montada`
- `Custo validado`

## Requisitos funcionais

- deve ser possivel iniciar o fluxo a partir de uma entrada de menu dedicada;
- deve ser possivel concluir o cadastro completo sem entrar nas telas tecnicas tradicionais;
- deve ser possivel aproveitar o assistente de receita ja existente;
- deve ser possivel gerar a estrutura minima de `Item`, `ItemVariation`, `Recipe` e `ItemCostSheet`;
- deve ser possivel revisar a receita sugerida antes da criacao final;
- deve ser possivel revisar o custo antes da confirmacao final.

## Requisitos nao funcionais

- a experiencia deve ser adequada para mobile;
- a modal deve ter performance aceitavel mesmo com catalogo grande de ingredientes;
- o fluxo deve preservar estado local entre etapas;
- a UI deve suportar retornos sem perda acidental do que foi digitado;
- a interface deve continuar utilizavel sem depender de hover ou elementos pequenos.

## Fora de escopo inicial

- exposicao de todos os campos tecnicos de `Item`;
- configuracao manual de variacoes dentro do wizard;
- configuracao manual da variacao de referencia dentro do wizard;
- descricao curta comercial;
- observacoes importantes;
- escolha manual de categoria.

## Resultado esperado

Ao final do wizard, o operador deve sentir que:

- cadastrou um sabor de pizza;
- montou a receita com ajuda;
- validou o custo;
- finalizou a tarefa sem precisar entender a arquitetura interna do sistema.

Ao final tecnico, o sistema deve ter preparado a estrutura operacional necessaria para continuar o ciclo de custo, ficha tecnica e precificacao.
