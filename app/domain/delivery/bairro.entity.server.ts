import type {
  Bairro,
  DeliveryFee,
  DistanceToPizzeria,
  PizzeriaLocation,
  PrismaClient,
} from "@prisma/client";

import prismaClient from "~/lib/prisma/client.server";

interface PrismaEntityProps {
  client: PrismaClient;
}

/**
 * Bairro com taxa de entrega e distância específicas para uma unidade
 */
export interface BairroWithFeeAndDistance extends Bairro {
  deliveryFee: DeliveryFee | null;
  distance: DistanceToPizzeria | null;
}

/**
 * Bairro mais próximo da unidade, com dados adicionais de distância
 */
export interface ClosestBairro {
  bairro: Bairro;
  distanceInKm: number;
  estimatedTimeInMin: number | null;
}

/**
 * Estatísticas das taxas de entrega para uma unidade
 */
export interface DeliveryFeeSummary {
  total: number;
  average: number;
  min: number;
  max: number;
}

class BairroEntity {
  private client: PrismaClient;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
  }

  async mainLocation() {
    return this.client.pizzeriaLocation.findFirst({
      where: { mainLocation: true },
    });
  }

  /**
   * Retorna todos os bairros com a taxa de entrega e a distância em km
   * relativas a uma determinada unidade (pizzeriaLocationId).
   */
  async findManyWithFees(
    fromLocationId: string | null = null
  ): Promise<BairroWithFeeAndDistance[]> {
    const mainLocation = await this.mainLocation();

    if (!fromLocationId) {
      fromLocationId = mainLocation?.id || "";
    }

    const bairros = await this.client.bairro.findMany({
      include: {
        deliveryFees: {
          where: { pizzeriaLocationId: fromLocationId },
        },
        distances: {
          where: { pizzeriaLocationId: fromLocationId },
        },
      },
    });

    return bairros.map((bairro) => ({
      ...bairro,
      deliveryFee: bairro.deliveryFees[0] || null,
      distance: bairro.distances[0] || null,
    }));
  }

  /**
   * Retorna um bairro específico pelo ID, incluindo taxas de entrega
   * e distâncias cadastradas para qualquer unidade.
   */
  async findById(id: string) {
    return this.client.bairro.findUnique({
      where: { id },
      include: {
        deliveryFees: true,
        distances: true,
      },
    });
  }

  /**
   * Lista apenas os bairros atendidos por uma unidade específica,
   * ou seja, que têm uma taxa de entrega cadastrada para essa unidade.
   */
  async findServedByLocation(pizzeriaLocationId: string) {
    return this.client.bairro.findMany({
      where: {
        deliveryFees: {
          some: { pizzeriaLocationId },
        },
      },
      include: {
        deliveryFees: {
          where: { pizzeriaLocationId },
        },
        distances: {
          where: { pizzeriaLocationId },
        },
      },
    });
  }

  /**
   * Retorna o bairro mais próximo de uma unidade, com base na menor
   * distância registrada em quilômetros.
   */
  async findClosestTo(
    pizzeriaLocationId: string
  ): Promise<ClosestBairro | null> {
    const result = await this.client.distanceToPizzeria.findFirst({
      where: { pizzeriaLocationId },
      orderBy: { distanceInKm: "asc" },
      include: {
        bairro: true,
      },
    });

    if (!result) return null;

    return {
      bairro: result.bairro,
      distanceInKm: result.distanceInKm,
      estimatedTimeInMin: result.estimatedTimeInMin,
    };
  }

  /**
   * Calcula um resumo estatístico das taxas de entrega para uma unidade:
   * média, mínimo, máximo e total de registros.
   */
  async calculateDeliverySummary(
    pizzeriaLocationId: string
  ): Promise<DeliveryFeeSummary | null> {
    const fees = await this.client.deliveryFee.findMany({
      where: { pizzeriaLocationId },
      select: { amount: true },
    });

    if (!fees.length) return null;

    const amounts = fees.map((f) => f.amount);
    const sum = amounts.reduce((acc, v) => acc + v, 0);
    const avg = sum / amounts.length;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

    return {
      total: fees.length,
      average: avg,
      min,
      max,
    };
  }

  /**
   * Busca bairros por nome, com correspondência parcial e case-insensitive.
   * Ideal para autocomplete ou filtros por nome digitado.
   */
  async searchByName(term: string) {
    return this.client.bairro.findMany({
      where: {
        name: {
          contains: term,
          mode: "insensitive",
        },
      },
    });
  }
}

const bairroEntity = new BairroEntity({
  client: prismaClient,
});

export { bairroEntity, BairroEntity };
