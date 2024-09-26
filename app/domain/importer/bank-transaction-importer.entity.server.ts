import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { OfxRawTransaction, OfxTransaction } from "./ofx-parser";
import prismaClient from "~/lib/prisma/client.server";
import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import { prismaIt } from "~/lib/prisma/prisma-it.server";

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

  parseOfxRawRecord(
    rawRecord: any,
    bankName: string
  ): Prisma.ImportSessionRecordBankTransactionCreateInput {
    const [day, month, year] = rawRecord.date.toString().split("/");
    const formattedTransactionDate = `${year}-${month}-${day}`;
    return {
      ...rawRecord,
      bankName,
      amount: parseFloat(rawRecord.amount),
      date: new Date(formattedTransactionDate).toISOString(),
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
