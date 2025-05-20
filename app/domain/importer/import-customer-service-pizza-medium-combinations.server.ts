import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";
import { ICsvImporter } from "./csv-importer.entity.server";

class ImportCustomerServicePizzaMediumCombinationsServer
  implements ICsvImporter
{
  async loadMany({
    records,
    mode = "override",
  }: {
    records: any[];
    mode: "override" | "append";
  }) {
    // Logic to import customer service pizza medium combinations
    console.log("Importing customer service pizza medium combinations...");

    if (mode === "override") {
      await prismaClient.importCustomerServicePizzaMediumCombinations.deleteMany(
        {}
      );
    }

    await Promise.all(
      records.map((row) => {
        const breakEvenPriceAmountNumber = parseFloat(
          row.break_even_price_amount.replace(",", ".")
        );
        const realMarginPercNumber = parseFloat(
          row.real_margin_perc.replace(",", ".")
        );
        const sellingPriceAmountNumber = parseFloat(
          row.selling_price_amount.replace(",", ".")
        );

        return prismaClient.importCustomerServicePizzaMediumCombinations.create(
          {
            data: {
              flavor1: row.flavor_1,
              flavor2: row.flavor_2,
              breakEvenPriceAmount: breakEvenPriceAmountNumber,
              realMarginPerc: realMarginPercNumber,
              sellingPriceAmount: sellingPriceAmountNumber,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }
        );
      })
    );

    return ok("Importação concluída com sucesso");
  }
}

export default ImportCustomerServicePizzaMediumCombinationsServer;
