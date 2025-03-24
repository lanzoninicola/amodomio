import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { useOutletContext } from "@remix-run/react";
import { GerenciamentoCardapioOutletContext } from "./admin.gerenciamento.cardapio";

export default function GerenciamentoCardapioExport() {
    const outletContext = useOutletContext<GerenciamentoCardapioOutletContext>();

    const allItems = outletContext?.items || [];

    if (!allItems.length) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-2xl text-gray-500">Nenhum item visível</div>
            </div>
        )
    }

    // Filtrar apenas os itens visíveis e ordenar alfabeticamente
    const sortedItems = allItems.filter(i => i.visible).sort((a, b) => a.name.localeCompare(b.name));

    // Dividir os itens em páginas com no máximo 5 itens por coluna, 2 colunas por página
    const chunkItemsForPages = (items: MenuItemWithAssociations[]) => {
        const pages = [];
        const itemsPerPage = 12; // 5 itens por coluna, 2 colunas por página

        for (let i = 0; i < items.length; i += itemsPerPage) {
            const pageItems = items.slice(i, i + itemsPerPage);
            pages.push(pageItems);
        }
        return pages;
    };

    const pages = chunkItemsForPages(sortedItems);

    const renderColumn = (column: MenuItemWithAssociations[]) => {
        let currentLetter = '';
        return column.map((item, index) => {
            const firstLetter = item.name[0].toUpperCase();
            const isFirstOfLetter = firstLetter !== currentLetter;
            currentLetter = firstLetter;

            // Abreviação dos ingredientes
            item.ingredients = item.ingredients?.replace(/molho de tomate italiano/gi, "MT");
            item.ingredients = item.ingredients?.replace(/muçarela/gi, "MC");

            return (
                <div key={index} className="py-2">
                    {isFirstOfLetter && (
                        <div className="flex items-center gap-x-2 bg-orange-200 mb-3 py-1 px-4">
                            <span className="text-md">{`#`}</span>
                            <span className="text-2xl font-semibold">{firstLetter}</span>
                        </div>
                    )}
                    <div className="ml-2 font-semibold text-xl uppercase font-mono leading-none bg-red-50 py-2 px-1 mb-1">
                        {item.name}
                    </div>
                    <div className="ml-2 text-xl leading-tight font-mono tracking-tight">
                        {item.ingredients}
                    </div>
                </div>
            );
        });
    };

    return (
        <>
            <style>
                {`
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                        }

                        .print-container {
                            display: flex;
                            flex-direction: column;
                            width: 100%;
                            height: 100%;
                            padding: 0;
                            page-break-after: always;
                        }

                        .page {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 1rem;
                            padding: 1cm;
                            box-sizing: border-box;
                            page-break-after: always;
                            height: 100vh;
                        }

                        .column {
                            display: flex;
                            flex-direction: column;
                            break-inside: avoid;
                            page-break-inside: avoid;
                        }
                    }

                    /* Força a orientação paisagem */
                    @page {
                        size: A4 landscape;
                        margin: 0;
                    }
                `}
            </style>
            <div className="print-container">
                {pages.map((pageItems, pageIndex) => (
                    <div key={pageIndex} className="page">
                        <div className="column">
                            {/* Renderiza os primeiros 5 itens na primeira coluna */}
                            {renderColumn(pageItems.slice(0, 6))}
                        </div>
                        <div className="column">
                            {/* Renderiza os próximos 5 itens na segunda coluna */}
                            {renderColumn(pageItems.slice(6, 12))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
