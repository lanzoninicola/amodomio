import { now } from "~/lib/dayjs";
import { BaseEntity } from "../base.entity";
import { Product } from "../product/product.model.server";
import {
  GroceryList,
  GroceryListItem,
  GroceryListModel,
} from "./grocery-list.model.server";

class GroceryListEntity extends BaseEntity<GroceryList> {
  async startPurchase(listId: string) {
    const list = await this.findById(listId);

    if (!list) {
      throw new Error("Lista não encontrada");
    }

    list.purchaseDate = now();

    this.update(listId, list);

    return list;
  }

  async addItem(listId: string, item: GroceryListItem) {
    const list = await this.findOne([{ field: "id", op: "==", value: listId }]);

    if (!list) {
      throw new Error("Lista não encontrada");
    }

    let itemsList = list?.items || [];

    const isItemExists = itemsList.some((item) => item.id === item.id);

    if (isItemExists) {
      throw new Error("Item já existe na lista");
    }

    itemsList = [
      ...itemsList,
      {
        ...item,
        quantity: 1,
      },
    ];

    await this.update(listId, {
      items: itemsList,
    });
  }

  async addBulkItems(listId: string, items: GroceryListItem[]) {
    const list = await this.findById(listId);

    if (!list) {
      throw new Error("Lista não encontrada");
    }

    let itemsList = list?.items || [];

    // add only which one does not already exists in the array
    items.forEach((item) => {
      if (!itemsList.some((i) => i.id === item.id)) {
        itemsList.push({
          ...item,
          quantity: 1,
        });
      }
    });

    await this.update(listId, {
      items: itemsList,
    });

    return list;
  }

  async removeItem(listId: string, itemId: string) {
    const list = await this.findById(listId);

    if (!list) {
      throw new Error("Lista não encontrada");
    }

    let nextItemsList = list?.items || [];

    console.log("pre filter", { nextItemsList, itemId });

    // remove the item from the list
    const nextItemsListFiltered = nextItemsList.filter(
      (item) => item.id !== itemId
    );

    console.log("post filter", { nextItemsListFiltered, itemId });

    await this.update(listId, {
      items: nextItemsListFiltered,
    });
  }
}

export const groceryListEntity = new GroceryListEntity(GroceryListModel);