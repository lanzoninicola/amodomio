import type { Prisma, Supplier } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import type { PrismaEntityProps } from "~/lib/prisma/types.server";

export function capitalizeSupplierName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}

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

  async findAllWithContacts() {
    return await this.client.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  }

  async findByIdWithContacts(id: string) {
    return await this.client.supplier.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  }

  async create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
    return await this.client.supplier.create({
      data: { ...data, name: capitalizeSupplierName(data.name) },
    });
  }

  async update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return await this.client.supplier.update({
      where: { id },
      data: {
        ...data,
        ...(typeof data.name === "string" ? { name: capitalizeSupplierName(data.name) } : {}),
      },
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
