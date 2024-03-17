import { FindPaginatedProps } from "~/lib/atlas-mongodb/mongo-base.entity.server";
import { BaseEntity } from "../base.entity";
import { CardapioPizzaAlTaglio } from "./cardapio-pizza-al-taglio.model.server";
import { WithId } from "mongodb";

export class CardapioPizzaAlTaglioEntityFirestore extends BaseEntity<CardapioPizzaAlTaglio> {
  async findPaginated({ pageNumber, pageSize }: FindPaginatedProps): Promise<{
    documents: WithId<Document>[];
    totalPages: number;
  }> {
    throw new Error("Method not implemented.");
  }

  async delete(id: string) {
    return await this._delete(id);
  }
}
