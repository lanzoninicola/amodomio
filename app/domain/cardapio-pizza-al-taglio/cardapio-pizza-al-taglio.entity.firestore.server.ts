import { FindPaginatedProps } from "~/lib/atlas-mongodb/mongo-base.entity.server";
import { BaseEntity } from "../base.entity";
import { CardapioPizzaAlTaglio } from "./cardapio-pizza-al-taglio.model.server";

export class CardapioPizzaAlTaglioEntityFirestore extends BaseEntity<CardapioPizzaAlTaglio> {
  // async findPaginated({ pageNumber, pageSize }: FindPaginatedProps): Promise<{
  //   documents: WithId<Document>[];
  //   totalPages: number;
  // }> {
  //   throw new Error("Method not implemented.");
  // }

  async delete(id: string) {
    return await this._delete(id);
  }

  async publish(id: string) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    const isPublished = cardapio.public;

    if (isPublished) {
      return;
    }

    const cardapioAlreadyPublic = await this.findOne([
      {
        field: "public",
        op: "==",
        value: true,
      },
    ]);

    if (cardapioAlreadyPublic !== undefined) {
      // @ts-ignore
      await this.update(cardapioAlreadyPublic.id, {
        ...cardapioAlreadyPublic,
        public: false,
      });
    }

    const nextCardapio: CardapioPizzaAlTaglio = {
      ...cardapio,
      public: true,
    };

    return await this.update(id, nextCardapio);
  }

  async mask(id: string) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    const isPublished = cardapio.public;

    if (!isPublished) {
      return;
    }

    const nextCardapio: CardapioPizzaAlTaglio = {
      ...cardapio,
      public: false,
    };

    return await this.update(id, nextCardapio);
  }
}
