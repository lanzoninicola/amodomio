import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { OfxRawTransaction, OfxTransaction } from "./ofx-parser";
import prismaClient from "~/lib/prisma/client.server";
import { Prisma } from "@prisma/client";
import dayjs from "dayjs";

export interface ReturnedCreateOfxRecord {
  inserted: {
    records: Prisma.BankTransactionCreateInput[];
    count: number;
  };
  duplicated: {
    records: Prisma.BankTransactionCreateInput[];
    count: number;
  };
}

class BankTransactionImporterEntity {
  private client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async importSingle(
    data: OfxRawTransaction
  ): Promise<ReturnedCreateOfxRecord> {
    const parsedTransaction = await this.parseRawTransaction(data);
    const isDuplicate = await this.isDuplicated(parsedTransaction.hash);

    let dbRecord = parsedTransaction;

    if (!isDuplicate) {
      await this.client.bankTransaction.create({
        data: {
          ...parsedTransaction,
        },
      });
    }

    return {
      inserted: {
        records: [dbRecord],
        count: 1,
      },
      duplicated: {
        records: isDuplicate ? [dbRecord] : [],
        count: isDuplicate ? 1 : 0,
      },
    };
  }

  async importMany(transactions: OfxRawTransaction[]) {
    // const record = await this.client.importBankTransaction.findFirst();

    // if (record) {
    //   // return {
    //   //   inserted: {
    //   //     records: [],
    //   //     count: 0,
    //   //   },
    //   //   duplicated: {
    //   //     records: [],
    //   //     count: 0,
    //   //   },
    //   // };

    //   throw new Error(
    //     "Não pode importar novos registros, parece que alguns registros foram importados mas não processados"
    //   );
    // }

    const dbRecords: Prisma.ImportBankTransactionCreateInput[] = [];
    const duplicatedRecords: OfxTransaction[] = [];

    for (const transaction of transactions) {
      const [day, month, year] = transaction.date.toString().split("/");
      const formattedTransactionDate = `${year}-${month}-${day}`; // "2024-09-13"

      const parsedTransaction = await this.parseRawTransaction(transaction);

      // check in the BankTransaction table if the transaction is duplicated
      const isDuplicate = await this.isDuplicated(parsedTransaction.hash);

      if (!isDuplicate) {
        dbRecords.push({
          amount: parsedTransaction.amount,
          createdAt: new Date().toISOString(),
          description: parsedTransaction.description,
          type: parsedTransaction.type,
          date: new Date(formattedTransactionDate).toISOString(),
        });
      } else {
        console.log(
          `Skipping duplicate transaction with hash: ${parsedTransaction.hash}`
        );
        duplicatedRecords.push(parsedTransaction); // Collect duplicates if needed
      }
    }

    if (dbRecords.length > 0) {
      await this.client.importBankTransaction.createMany({ data: dbRecords });
    }

    // Return duplicates if requested, otherwise return inserted records
    return {
      inserted: {
        records: dbRecords,
        count: dbRecords.length,
      },
      duplicated: {
        records: duplicatedRecords,
        count: duplicatedRecords.length,
      },
    };
  }

  async isDuplicated(hashRecord: string) {
    const record = await this.client.bankTransaction.findFirst({
      where: { hashRecord },
    });

    return !!record;
  }

  private async parseRawTransaction(
    transaction: OfxRawTransaction
  ): Promise<OfxTransaction> {
    console.log(transaction.date);

    return {
      ...transaction,
      amount: parseFloat(transaction.amount),
      date: dayjs(transaction.date).toDate(),
      hash: await this.createTransactionHash(transaction),
      descriptionHash: await this.createDescriptionHash(transaction),
      createdAt: new Date().toISOString(),
    };
  }

  private async createHash(data: string) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));

    // Convert the array buffer to a hexadecimal string
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  private async createTransactionHash(transaction: OfxRawTransaction) {
    const data = `${transaction.date}-${transaction.amount}-${transaction.description}-${transaction.type}`;

    return await this.createHash(data);
  }

  private async createDescriptionHash(transaction: OfxRawTransaction) {
    return await this.createHash(transaction.description);
  }
}

const bankTransactionImporterEntity = new BankTransactionImporterEntity({
  client: prismaClient,
});

export { bankTransactionImporterEntity };
