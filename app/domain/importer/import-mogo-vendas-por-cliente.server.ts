import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";
import { ICsvImporter } from "./csv-importer.entity.server";

class ImportMogoVendasPorCliente implements ICsvImporter {
  async loadMany({
    records,
    mode = "override",
  }: {
    records: any[];
    mode: "override" | "append";
  }) {
    // Logic to import customer service pizza medium combinations
    console.log("Importing vendas por cliente...");

    if (mode === "override") {
      await prismaClient.importMogoVendaPorCliente.deleteMany({});
    }

    await Promise.all(
      records.map((row) => {
        const amount = parseFloat(row.amount.replace(",", "."));
        return prismaClient.importMogoVendaPorCliente.create({
          data: {
            amount,
            customerName: row.customer_name,
            orderNumber: row.order_number,
            paidAtDate: row.paid_at_date,
            paidAtHour: row.paid_at_hour,
            paymentType: row.payment_type,
            productName: row.product_name,
            quantity: row.quantity,
            orderTag: row.order_tag,
            phone: row.phone,
            tableLabel: row.table_label,
          },
        });
      })
    );

    return ok("Importação concluída com sucesso");
  }
}

export default ImportMogoVendasPorCliente;
