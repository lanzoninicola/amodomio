
import { redirect, type LoaderFunction } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import responseCSV from "~/domain/export-csv/functions/response-csv";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import getSearchParam from "~/utils/get-search-param";
import { badRequest } from "~/utils/http-response.server";


export const loader: LoaderFunction = async ({ request, params }) => {

  let loggedUser: LoggedUser = await authenticator.isAuthenticated(request);

  if (!loggedUser) {
    return redirect("/cardapio")
  }

  const format = getSearchParam({ request, paramName: "format" });
  const context = getSearchParam({ request, paramName: "context" });

  console.log({ format, context })

  if (format !== "csv") {
    return badRequest("Invalid export format");
  }

  if (context === 'undefined' || context === null || context === "" || context === "null" || !context) {
    return badRequest("Invalid export context");
  }

  let data: [] = [];

  if (context === "menu-items-price-variations") {

    const [err, menuItemsWithPrices] = await prismaIt(menuItemPrismaEntity.findManyWithSellPriceVariations({
      where: {
        visible: true
      }
    }));

    if (err) {
      return badRequest(err)
    }

    const mappedData = menuItemsWithPrices.map(menuItem => {
      let nextData = {
        id: menuItem.id,
        name: menuItem.name,

      }

      // Mapping price variations into the desired format
      menuItem.priceVariations.forEach(variation => {
        // @ts-ignore
        nextData[variation.label] = variation.amount;
      });

      return nextData;
    });

    // @ts-ignore
    data = mappedData;
  }

  if (context === "cardapio-items-basic-list") {

    const listFlat = await menuItemPrismaEntity.findAll({
      option: {
        sorted: true,
        direction: "asc"
      }
    }, {
      imageTransform: true,
      imageScaleWidth: 64,
    })

    const mappedData = listFlat.map(i => {

      const nextData = {
        group: i.MenuItemGroup?.name,
        category: i.Category.name,
        name: i.name,
        price: 0,
        upcoming: i.upcoming,
        visible: i.visible,
        active: i.active
      }
      nextData.price = i.MenuItemSellingPriceVariation.filter(spv => spv.MenuItemSize?.key === "pizza-medium").map(r => r.priceAmount)[0]
      return nextData
    })

    data = mappedData
  }

  if (Array.isArray(data) && data.length === 0) {
    return badRequest("No data found for the requested context");
  }

  return responseCSV(data);


};

