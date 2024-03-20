import { PizzaSlice, PizzaSliceModel } from "./pizza-al-taglio.model.server";
import { BaseEntity } from "../base.entity";

class PizzaSliceEntity extends BaseEntity<PizzaSlice> {
  async delete(id: string) {
    return await this._delete(id);
  }
}

export const pizzaSliceEntity = new PizzaSliceEntity(PizzaSliceModel);
