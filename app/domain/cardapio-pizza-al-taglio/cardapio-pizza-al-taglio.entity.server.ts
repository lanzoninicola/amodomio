import {
  CardapioPizzaAlTaglio,
  CardapioPizzaAlTaglioModel,
} from "./cardapio-pizza-al-taglio.model.server";
import { MongoBaseEntity } from "~/lib/atlas-mongodb/mongo-base.entity.server";

class CardapioPizzaAlTaglioEntity extends MongoBaseEntity<
  typeof CardapioPizzaAlTaglioModel
> {
  async create(newRecord: CardapioPizzaAlTaglio) {
    // check if already exist the record in the same date, if so returns error otherwise insert one
    const record = await this.model.findOne({ date: newRecord.date });

    if (record) {
      throw new Error(
        `Já existe um registro para esta data: ${newRecord.date}`
      );
    }

    return await this.model.insertOne(newRecord);
  }

  /**
   * if the record is found it will updated
   *
   * @param newRecord the data to insert
   * @returns
   */
  async createOrUpdate(newRecord: CardapioPizzaAlTaglio) {
    // check if already exist the record in the same date, if so returns error otherwise insert one
    const record = await this.model.findOne({ date: newRecord.date });

    if (!record) {
      return await this.create(newRecord);
    }

    return await this.model.updateOne(
      { date: newRecord.date },
      {
        $set: {
          date: newRecord.date,
          slices: {
            ...record.slices,
            ...newRecord.slices,
          },
        },
      }
    );
  }

  //   async findAll() {
  //     const cursor = await this.model.find().sort({ date: 1 });

  //       await cursor.(document => {
  //       console.log(document);
  //     });
  //   }
}

export const cardapioPizzaAlTaglioEntity = new CardapioPizzaAlTaglioEntity({
  model: CardapioPizzaAlTaglioModel,
});
