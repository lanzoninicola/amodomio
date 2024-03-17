import { PizzaSlice, PizzaSliceModel } from "./pizza-al-taglio.model.server";
import { BaseEntity } from "../base.entity";

class PizzaSliceEntity extends BaseEntity<PizzaSlice> {}

export const pizzaSliceEntity = new PizzaSliceEntity(PizzaSliceModel);
