import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";

class ImportCustomerServicePizzaMediumCombinationsServer {
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
        console.log({ row });

        await tx.importCustomerServicePizzaMediumCombinations.create({
          data: {
            flavor1: row.flavor1,
            flavor2: row.flavor2,
            breakEvenPriceAmount: row.breakEvenPriceAmount,
            realMarginPerc: row.realMarginPerc,
            sellPriceAmount: row.sellPriceAmount,
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
