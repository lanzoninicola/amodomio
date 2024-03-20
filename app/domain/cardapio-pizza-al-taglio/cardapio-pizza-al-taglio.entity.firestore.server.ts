import { FindPaginatedProps } from "~/lib/atlas-mongodb/mongo-base.entity.server";
import { BaseEntity } from "../base.entity";
import {
  CardapioPizzaAlTaglio,
  CardapioPizzaSlice,
} from "./cardapio-pizza-al-taglio.model.server";
import { now } from "~/lib/dayjs";
import { PizzaSlice } from "../pizza-al-taglio/pizza-al-taglio.model.server";
import { pizzaSliceEntity } from "../pizza-al-taglio/pizza-al-taglio.entity.server";

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

  async sliceAdd(id: string, slice: PizzaSlice, quantity: number) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    const newSlice = await pizzaSliceEntity.create({
      ...slice,
      toppings: slice.toppings,
      category: slice.category,
    });

    if (!newSlice) {
      throw new Error("Erro ao criar a fatia de pizza");
    }

    // @ts-ignore
    delete newSlice._client;
    // @ts-ignore
    delete newSlice._collectionName;

    return await this.update(id, {
      ...cardapio,
      slices: [
        ...cardapio.slices,
        {
          ...newSlice,
          quantity,
          isAvailable: true,
          value: this.setSlicePrice(slice),
        },
      ],
    });
  }

  async sliceUpdateToppings(id: string, sliceId: string, toppings: string) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    const sliceFound = cardapio.slices.find((s) => s.id === sliceId);

    if (!sliceFound) {
      return;
    }

    // update the pizza slice record
    await pizzaSliceEntity.update(sliceId, {
      ...sliceFound,
      toppings,
    });

    // update the pizza slice record inside the cardapio record
    return await this.update(id, {
      ...cardapio,
      slices: cardapio.slices.map((slice) => {
        if (slice.id === sliceId) {
          return {
            ...slice,
            toppings,
          };
        }

        return slice;
      }),
    });
  }

  async sliceUpdateQuantity(id: string, sliceId: string, quantity: number) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    return await this.update(id, {
      ...cardapio,
      slices: cardapio.slices.map((slice) => {
        if (slice.id === sliceId) {
          return {
            ...slice,
            quantity,
          };
        }

        return slice;
      }),
    });
  }

  async sliceDelete(id: string, sliceId: string) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    const nextSlice = cardapio.slices.filter((slice) => slice.id !== sliceId);

    return await this.update(id, {
      ...cardapio,
      slices: nextSlice,
    });
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

    return await this.update(id, {
      ...cardapio,
      slices: nextSlice,
    });
  }

  /**
   * Recover the stock of slice
   *
   * @param id cardapioId
   * @param sliceId
   * @returns
   */
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

  /**
   * Recover the stock of all slices
   *
   * @param id cardapioId
   * @returns
   */
  async outOfStockRecover(id: string) {
    const cardapio = await this.findById(id);

    if (!cardapio) {
      throw new Error("Cardapio não encontrado");
    }

    const nextSlice = cardapio.slices.map((slice) => {
      return {
        ...slice,
        isAvailable: true,
      };
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
