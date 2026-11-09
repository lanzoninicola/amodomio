# Domínio Linha de Produto

`ProductLine` é o nível superior da organização comercial dos itens vendáveis.

## Hierarquia

```text
ProductLine
  -> ItemGroup
       -> ItemSellingInfo.Category
       -> ItemTag / Tag
```

- cada grupo pertence obrigatoriamente a uma linha;
- categoria e tags permanecem no item e funcionam como classificações dentro do grupo;
- a linha não substitui a visibilidade individual do item.

## Visibilidade por canal

`ProductLineSellingChannel` representa a autorização da linha em um `ItemSellingChannel`.

Para um item aparecer em um canal, todas estas condições devem ser satisfeitas:

1. linha ativa;
2. linha visível no canal;
3. item ativo e vendável;
4. item visível no mesmo canal;
5. item não marcado como lançamento futuro.

Alterações de linha ou canal invalidam os caches do cardápio e do handler de preços.

O payload público mantém os metadados da linha em cada grupo. O catálogo renderiza a hierarquia `Linha -> Grupo -> Itens` e, quando houver mais de uma linha visível, apresenta um seletor de linhas antes dos filtros e grupos. Com apenas uma linha, o seletor fica oculto e a experiência atual é preservada.

## Administração

A página `/admin/gerenciamento/cardapio/product-lines`, acessível em `Vendas > Cardápio > Linhas de produtos`, permite:

- criar linhas;
- editar nome, chave, descrição, ordem e estado ativo;
- configurar visibilidade por canal;
- excluir linhas sem grupos associados.

Linhas com grupos não podem ser excluídas. Os grupos devem ser movidos para outra linha antes da exclusão.

No cadastro comercial do item (`/admin/items/:id/venda/comercial`), a seção Organização segue a ordem `Linha de produto -> Grupo -> Categoria`. A seleção da linha filtra os grupos disponíveis, e o servidor valida que o grupo realmente pertence à linha informada.
