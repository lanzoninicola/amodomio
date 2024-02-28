import { BaseEntity } from "../base.entity";
import {
  PromoPizzaPhoto,
  PromoPizzaPhotoModel,
} from "./promo-pizza-photos.model.server";

class PromoPizzaPhotoEntity extends BaseEntity<PromoPizzaPhoto> {}

export const promoPizzaPhotoEntity = new PromoPizzaPhotoEntity(
  PromoPizzaPhotoModel
);
