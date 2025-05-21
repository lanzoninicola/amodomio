import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";
import { ICsvImporter } from "./csv-importer.entity.server";

class ImportCustomerServicePizzaBiggerCombinationsServer
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
    console.log("Importing customer service pizza bigger combinations...");

    if (mode === "override") {
      await prismaClient.importCustomerServicePizzaBiggerCombinations.deleteMany(
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

        return prismaClient.importCustomerServicePizzaBiggerCombinations.create(
          {
            data: {
              topping1: row.topping_1,
              ingredient1: row.ingredient_1,
              topping2: row.topping_2,
              ingredient2: row.ingredient_2,
              topping3: row.topping_3,
              ingredient3: row.ingredient_3,
              topping4: row.topping_4,
              ingredient4: row.ingredient_4,
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

export default ImportCustomerServicePizzaBiggerCombinationsServer;
