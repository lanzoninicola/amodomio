import { Prisma } from "@prisma/client";
import { prismaClient } from "~/lib/prisma/prisma-it.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export class SettingPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.SettingWhereInput) {
    return await this.client.setting.findMany({
      where,
    });
  }

  async findById(id: string) {
    return await this.client.setting.findUnique({ where: { id } });
  }

  async create(data: Prisma.SettingCreateInput) {
    return await this.client.setting.create({ data });
  }

  async update(id: string, data: Prisma.SettingUpdateInput) {
    return await this.client.setting.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.setting.delete({ where: { id } });
  }

  async findAllContexts(): Promise<string[]> {
    return await this.client.$queryRaw`SELECT DISTINCT context FROM Settings`;
  }
}

const settingPrismaEntity = new SettingPrismaEntity({
  client: prismaClient,
});

export { settingPrismaEntity };
