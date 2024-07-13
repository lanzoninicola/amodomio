import { Prisma, PrismaClient } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";

export interface ISettingOption {
  id: string;
  context: string;
  name: string;
  type: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ISettingPrismaEntity {
  client: PrismaClient;

  findAll(where?: Prisma.SettingWhereInput): Promise<ISettingOption[]>;

  findAllByContext(contextName: string): Promise<ISettingOption[]>;

  findByOptionName(name: string): Promise<ISettingOption | null>;

  findById(id: string): Promise<ISettingOption | null>;

  updateOrCreate(
    data: Prisma.SettingWhereInput
  ): Promise<ISettingOption | undefined>;

  updateOrCreateMany(
    data: Prisma.SettingWhereInput[]
  ): Promise<(ISettingOption | undefined)[]>;

  create(data: Prisma.SettingCreateInput): Promise<ISettingOption>;

  update(id: string, data: Prisma.SettingUpdateInput): Promise<ISettingOption>;

  delete(id: string): Promise<ISettingOption>;

  findAllContexts(): Promise<string[]>;
}

class SettingPrismaEntity implements ISettingPrismaEntity {
  client;
  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async findAll(where?: Prisma.SettingWhereInput) {
    return await this.client.setting.findMany({
      where,
    });
  }

  async findAllByContext(contextName: string) {
    const where: Prisma.SettingWhereInput = {
      context: {
        equals: contextName,
      },
    };

    return await this.client.setting.findMany({
      where,
    });
  }

  async findByOptionName(name: string): Promise<ISettingOption | null> {
    return await this.client.setting.findFirst({ where: { name } });
  }

  async findById(id: string) {
    return await this.client.setting.findUnique({ where: { id } });
  }

  async updateOrCreate(data: Prisma.SettingWhereInput) {
    const contextName = data?.context;
    const optionName = data?.name;

    if (!contextName || !optionName) return;

    const record = await this.client.setting.findFirst({
      where: {
        context: contextName,
        name: optionName,
      },
    });

    if (record) {
      const nextData = {
        ...record,
        ...data,
      } as Prisma.SettingUpdateInput;

      return await this.update(record.id, nextData);
    }

    return await this.create(data as Prisma.SettingCreateInput);
  }

  async updateOrCreateMany(data: Prisma.SettingWhereInput[]) {
    const upsertPromise = data.map((item) => this.updateOrCreate(item));

    return Promise.all(upsertPromise);
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

export { settingPrismaEntity, type ISettingPrismaEntity };
