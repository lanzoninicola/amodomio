import { FindPaginatedProps } from "~/lib/atlas-mongodb/mongo-base.entity.server";
import { BaseEntity } from "../base.entity";
import { CardapioPizzaAlTaglio } from "./cardapio-pizza-al-taglio.model.server";
import { now } from "~/lib/dayjs";
import { PizzaSlice } from "../pizza-al-taglio/pizza-al-taglio.model.server";

export class CardapioPizzaAlTaglioEntityFirestore extends BaseEntity<CardapioPizzaAlTaglio> {
  private meatSlicePriceAmount: number = 24;
  private vegetarianSlicePriceAmount: number = 17;
  private margheritaSlicePriceAmount: number = 17;

  // async findPaginated({ pageNumber, pageSize }: FindPaginatedProps): Promise<{
  //   documents: WithId<Document>[];
  //   totalPages: number;
  // }> {
  //   throw new Error("Method not implemented.");
  // }

  async add(record: Omit<CardapioPizzaAlTaglio, "public" | "name">) {
    const newSlices = record.slices.map((slice) => ({
      ...slice,
      value: this.setSlicePrice(slice),
      isAvailable: true,
    }));

    const newRecord = {
      ...record,
      slices: newSlices,
      public: false,
      name: `Cardápio do dia ${now()}`,
    };

    return await this.create(newRecord);
  }

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

  async sliceOutOfStock(id: string, sliceId: string) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    const nextSlice = cardapio.slices.map((slice) => {
      if (slice.id === sliceId) {
        return {
          ...slice,
          isAvailable: false,
        };
      }

      return slice;
    });

    console.log({ nextSlice });

    return await this.update(id, {
      ...cardapio,
      slices: nextSlice,
    });
  }

  async sliceOutOfStockRecover(id: string, sliceId: string) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    const nextSlice = cardapio.slices.map((slice) => {
      if (slice.id === sliceId) {
        return {
          ...slice,
          isAvailable: true,
        };
      }

      return slice;
    });

    return await this.update(id, {
      ...cardapio,
      slices: nextSlice,
    });
  }

  private setSlicePrice(slice: PizzaSlice) {
    if (slice.category === "carne") {
      return `R$${this.meatSlicePriceAmount}`;
    }

    if (slice.category === "vegetariana") {
      return `R$${this.vegetarianSlicePriceAmount}`;
    }

    if (slice.category === "margherita") {
      return `R$${this.margheritaSlicePriceAmount}`;
    }
  }

  async findPublicCardapio() {
    const records = await this.findOne([
      {
        field: "public",
        op: "==",
        value: true,
      },
    ]);

    const vegetarianSlices = records?.slices.filter(
      (s) => s.category === "vegetariana"
    );
    const meatSlices = records?.slices.filter((s) => s.category === "carne");
    const margheritaSlices = records?.slices.filter(
      (s) => s.category === "margherita"
    );

    return {
      vegetarian: vegetarianSlices || [],
      meat: meatSlices || [],
      margherita: margheritaSlices || [],
    };
  }
}
