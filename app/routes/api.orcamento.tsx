import { name } from "@cloudinary/url-gen/actions/namedTransformation";
import { LoaderFunctionArgs } from "@remix-run/node";
import { mock } from "node:test";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { bairroEntity } from "~/domain/delivery/bairro.entity.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";

type MenuItemPriceSummary = {
  menuItemId: string;
  name: string;
  groupName?: string;
  priceAmount: number;
  previousPriceAmount: number;
  discountPercentage: number;
  profitActualPerc: number;
  profitExpectedPerc: number;
  priceExpectedAmount: number;
};

const mockData: Record<string, MenuItemPriceSummary[]> = {
  "pizza-small": [
    {
      menuItemId: "1",
      name: "Margarita",
      groupName: "Tradicional",
      priceAmount: 25.0,
      previousPriceAmount: 30.0,
      discountPercentage: 16.67,
      profitActualPerc: 20.0,
      profitExpectedPerc: 25.0,
      priceExpectedAmount: 30.0,
    },
    {
      menuItemId: "2",
      name: "Pepperoni",
      groupName: "Tradicional",
      priceAmount: 30.0,
      previousPriceAmount: 35.0,
      discountPercentage: 14.29,
      profitActualPerc: 22.0,
      profitExpectedPerc: 27.0,
      priceExpectedAmount: 35.0,
    },
  ],
  "pizza-medium": [
    {
      menuItemId: "1",
      name: "Margarita",
      groupName: "Tradicional",
      priceAmount: 35.0,
      previousPriceAmount: 40.0,
      discountPercentage: 12.5,
      profitActualPerc: 18.0,
      profitExpectedPerc: 23.0,
      priceExpectedAmount: 40.0,
    },
    {
      menuItemId: "2",
      name: "Pepperoni",
      groupName: "Tradicional",
      priceAmount: 40.0,
      previousPriceAmount: 45.0,
      discountPercentage: 11.11,
      profitActualPerc: 19.0,
      profitExpectedPerc: 24.0,
      priceExpectedAmount: 45.0,
    },
  ],
  "pizza-bigger": [
    {
      menuItemId: "1",
      name: "Margarita",
      groupName: "Tradicional",
      priceAmount: 45.0,
      previousPriceAmount: 50.0,
      discountPercentage: 10.0,
      profitActualPerc: 16.0,
      profitExpectedPerc: 21.0,
      priceExpectedAmount: 50.0,
    },
    {
      menuItemId: "2",
      name: "Pepperoni",
      groupName: "Tradicional",
      priceAmount: 50.0,
      previousPriceAmount: 55.0,
      discountPercentage: 9.09,
      profitActualPerc: 16.0,
      profitExpectedPerc: 21.0,
      priceExpectedAmount: 50.0,
    },
  ],
}

export async function loader({ request }: LoaderFunctionArgs) {

  const apiKey = request.headers.get("x-api-key");

  const authResp = restApi.authorize(apiKey);


  if (authResp.status >= 399) {

    console.log({ authResp })
    return badRequest(authResp.message);
  }


  // Here you would typically fetch or process the menu item selling prices
  // For demonstration, we return a static message

  const items = await menuItemPrismaEntity.findManyWithSellPriceVariations(
    {
      where: {
        active: true,

      }
    },
    "cardapio",
    {
      includeAuditRecords: false,
    }
  )

  const map: Record<string, MenuItemPriceSummary[]> = {};

  for (const item of items) {
    for (const variation of item.sellPriceVariations) {
      const sizeKey = variation.sizeKey;
      if (!sizeKey) continue; // ignora variações sem chave de tamanho

      const entry: MenuItemPriceSummary = {
        menuItemId: item.menuItemId,
        name: item.name,
        groupName: item.group?.name ?? undefined,
        priceAmount: variation.priceAmount,
        previousPriceAmount: variation.previousPriceAmount,
        discountPercentage: variation.discountPercentage,
        profitActualPerc: variation.profitActualPerc,
        profitExpectedPerc: variation.profitExpectedPerc,
        priceExpectedAmount: variation.priceExpectedAmount,
      };

      if (!map[sizeKey]) {
        map[sizeKey] = [];
      }

      map[sizeKey].push(entry);
    }
  }



  delete map["pizza-slice"]; // Remove "pizza-slice" if it exists

  const sizes = await menuItemSizePrismaEntity.findAll()

  const bairros = await bairroEntity.findManyWithFees()

  return ok({
    options: map,
    sizes: sizes.filter(size => size.key !== "pizza-slice"),
    bairros

  });

}