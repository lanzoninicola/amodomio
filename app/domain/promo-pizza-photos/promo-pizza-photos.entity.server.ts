import { BaseEntity } from "../base.entity";
import {
  PromoPizzaPhoto,
  PromoPizzaPhotoModel,
} from "./promo-pizza-photos.model.server";

export interface PromoCode {
  code: string;
  active: boolean;
}

class PromoPizzaPhotoEntity extends BaseEntity<PromoPizzaPhoto> {
  async delete(id: string) {
    return await this._delete(id);
  }

  getAllPromoCodes(): PromoCode[] {
    const codes = [
      {
        code: "20240305-pizza-photos",
        active: false,
      },
      {
        code: "20240326-pizza-photos",
        active: false,
      },
      {
        code: "20240423-pizza-photos",
        active: false,
      },
      {
        code: "20240430-pizza-photos",
        active: false,
      },
      {
        code: "2024014-pizza-photos",
        active: false,
      },
      {
        code: "20240514-pizza-photos",
        active: false,
      },
      {
        code: "20240528-pizza-photos",
        active: false,
      },
    ];

    const shouldPromoCodeActive = process.env.PIZZA_PHOTOS_PROMO_CODE;

    return codes.map((c) => {
      return {
        ...c,
        active: c.code === shouldPromoCodeActive,
      };
    });
  }

  getActivePromoCode() {
    return this.getAllPromoCodes().find((c) => c.active);
  }
}

export const promoPizzaPhotoEntity = new PromoPizzaPhotoEntity(
  PromoPizzaPhotoModel
);
