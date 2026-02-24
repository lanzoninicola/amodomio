import type { Prisma, Supplier } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import type { PrismaEntityProps } from "~/lib/prisma/types.server";

class SupplierPrismaEntity {
  client;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.SupplierWhereInput): Promise<Supplier[]> {
    return await this.client.supplier.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string): Promise<Supplier | null> {
    return await this.client.supplier.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
    return await this.client.supplier.create({ data });
  }

  async update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return await this.client.supplier.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Supplier> {
    return await this.client.supplier.delete({
      where: { id },
    });
  }
}

const supplierPrismaEntity = new SupplierPrismaEntity({ client: prismaClient });

export { supplierPrismaEntity };
