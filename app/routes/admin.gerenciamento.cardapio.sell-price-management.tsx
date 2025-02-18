import ExportCsvButton from "~/domain/export-csv/components/export-csv-button/export-csv-button";



export default function AdminGerenciamentoCardapioSellPriceManagement() {

    return <div>

        <ExportCsvButton context="menu-items-price-variations">
            Exportar atual preços de venda
        </ExportCsvButton>
    </div>
}