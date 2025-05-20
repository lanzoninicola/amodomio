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

    return await prismaClient.$transaction(async (tx) => {
      if (mode === "override") {
        await tx.importCustomerServicePizzaMediumCombinations.deleteMany({});
      }

      for (const row of records) {
        const breakEvenPriceAmountNumber = parseFloat(
          row.break_even_price_amount.replace(",", ".")
        );
        const realMarginPercNumber = parseFloat(
          row.real_margin_perc.replace(",", ".")
        );
        const sellingPriceAmountNumber = parseFloat(
          row.selling_price_amount.replace(",", ".")
        );

        await tx.importCustomerServicePizzaMediumCombinations.create({
          data: {
            flavor1: row.flavor_1,
            flavor2: row.flavor_2,
            breakEvenPriceAmount: breakEvenPriceAmountNumber,
            realMarginPerc: realMarginPercNumber,
            sellingPriceAmount: sellingPriceAmountNumber,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }

      return ok("Importação concluída com sucesso");
    });
  }
}

export default ImportCustomerServicePizzaMediumCombinationsServer;
