import { BaseEntity } from "../base.entity";
import {
  PromoPizzaPhoto,
  PromoPizzaPhotoModel,
} from "./promo-pizza-photos.model.server";

class PromoPizzaPhotoEntity extends BaseEntity<PromoPizzaPhoto> {
  async delete(id: string) {
    return await this._delete(id);
  }
}

export const promoPizzaPhotoEntity = new PromoPizzaPhotoEntity(
  PromoPizzaPhotoModel
);
