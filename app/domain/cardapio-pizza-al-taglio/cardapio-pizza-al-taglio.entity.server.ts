import { ObjectId } from "mongodb";
import {
  CardapioPizzaAlTaglio,
  CardapioPizzaAlTaglioModel,
} from "./cardapio-pizza-al-taglio.model.server";
import { MongoBaseEntity } from "~/lib/atlas-mongodb/mongo-base.entity.server";

class CardapioPizzaAlTaglioEntity extends MongoBaseEntity<
  typeof CardapioPizzaAlTaglioModel
> {
  async create(newRecord: CardapioPizzaAlTaglio) {
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
    const record = await this.model.findOne({
      _id: new ObjectId(newRecord?._id),
    });

    if (!record) {
      return await this.create(newRecord);
    }

    return await this.model.updateOne(
      { _id: new ObjectId(newRecord?._id) },
      {
        $set: {
          slices: {
            ...record.slices,
            ...newRecord.slices,
          },
          publishedDate: newRecord.publishedDate,
          published: newRecord.published,
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
