import { PizzaSlice, PizzaSliceModel } from "./pizza-al-taglio.model.server";
import { BaseEntity } from "../base.entity";

class PizzaSliceEntity extends BaseEntity<PizzaSlice> {
  async findAllSlices(options?: {
    order?: "asc" | "desc";
    orderBy?: "createdAt";
  }) {
    const slices = await this.findAll();
    const order = options?.order || "asc";
    const orderBy = options?.orderBy || "createdAt";

    slices.sort((a, b) => {
      // @ts-ignore
      const valueA = a[orderBy];
      // @ts-ignore
      const valueB = b[orderBy];

      if (valueA === undefined || valueB === undefined) {
        return 0; // Handle undefined values, placing them at an arbitrary position
      }

      if (order === "asc") {
        if (valueA < valueB) return -1;
        if (valueA > valueB) return 1;
        return 0;
      } else {
        if (valueA < valueB) return 1;
        if (valueA > valueB) return -1;
        return 0;
      }
    });

    return slices;
  }

  async delete(id: string) {
    return await this._delete(id);
  }
}

export const pizzaSliceEntity = new PizzaSliceEntity(PizzaSliceModel);
