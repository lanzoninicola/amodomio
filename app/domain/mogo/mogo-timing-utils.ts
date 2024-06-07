import { MogoOrderHttpResponse } from "./types";

export type MogoPizzaFamiliaId = "19";
export type MogoPizzaMediaId = "18";

export type PreparationAndCookingTimeConfig = {
  [key in MogoPizzaFamiliaId | MogoPizzaMediaId]: {
    preparationTime: number;
    cookingTime: number;
  };
};

/**
 * Calculate the total of time for the preparation and cooking
 *
 * @param order the order to calculate the time (Mogo Object)
 * @param whichTime
 * @returns
 */
function calculateTotalSingleProductTime(
  order: MogoOrderHttpResponse,
  whichTime: "preparationTime" | "cookingTime"
) {
  // Define preparation times for each product
  const timeConfig: PreparationAndCookingTimeConfig = {
    // pizza familia
    "19": {
      preparationTime: 10,
      cookingTime: 7,
    },
    // pizza media
    "18": {
      preparationTime: 4,
      cookingTime: 4,
    },
  };

  let totalTime = 0;

  order.Itens.forEach((item) => {
    if (item.IdProduto > 19) return;

    const idProdutoStr = String(item.IdProduto) as
      | MogoPizzaFamiliaId
      | MogoPizzaMediaId;

    const singleProductTime = timeConfig[idProdutoStr][whichTime];

    if (singleProductTime) {
      totalTime += singleProductTime * item.Quantidade;
    }
  });

  return totalTime;
}

export function calculateTotalTime(
  orders: MogoOrderHttpResponse[],
  whichTime: "preparationTime" | "cookingTime"
) {
  return orders
    .map((o) => calculateTotalSingleProductTime(o, whichTime))
    .reduce((a, b) => a + b, 0);
}
