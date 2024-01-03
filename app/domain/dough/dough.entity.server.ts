import { BaseEntity } from "../base.entity";
import { Dough, DoughModel } from "./dough.model.server";

class DoughEntity extends BaseEntity<Dough> {}

const doughEntity = new DoughEntity(DoughModel);

export { doughEntity };
