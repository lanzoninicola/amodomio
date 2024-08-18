import tryit from "~/utils/try-it";
import {
  MogoBaseOrder,
  MogoHttpClientInterface,
  MogoOrderHttpResponse,
  MogoOrderItem,
  MogoOrderWithDiffTime,
} from "./types";
import MogoHttpClient from "./mogo-http-client.server";
import MogoHttpClientMock from "./mogo-http-client.mock.server";
import convertMinutesToHHMM from "~/utils/convert-minutes-to-hhmm";
import {
  SettingEntityInterface,
  settingEntity,
} from "../setting/setting.entity.server";
import { Setting } from "../setting/setting.model.server";
import { dayjs, utc } from "~/lib/dayjs";
import { settingPrismaEntity } from "../setting/setting.prisma.entity.server";

interface MogoEntityProps {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;
  // offset hours related to the deployment server
  serverTimezoneOffset: number;
}

export type MogoPizzaFamiliaId = "19";
export type MogoPizzaMediaId = "18";

export type PreparationAndCookingTimeConfig = {
  [key in MogoPizzaFamiliaId | MogoPizzaMediaId]: {
    preparationTime: number;
    cookingTime: number;
  };
};

class MogoEntity {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;
  serverTimezoneOffset: number;

  // Define preparation times for each product
  timeConfig: PreparationAndCookingTimeConfig = {
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

  constructor({ httpClient, settings, serverTimezoneOffset }: MogoEntityProps) {
    this.httpClient = httpClient;
    this.settings = settings;
    this.serverTimezoneOffset = serverTimezoneOffset;
  }

  async getOrdersOpened(): Promise<MogoBaseOrder[]> {
    const [err, ordersRes] = await tryit(this.httpClient.getOrdersOpened());

    if (err) {
      throw err;
    }

    if (!Array.isArray(ordersRes)) {
      return [];
    }

    return ordersRes.map((o: MogoOrderHttpResponse) => {
      let totDispatchTimeInMinutes: number = 0;

      return {
        ...o,
        Itens: o.Itens.map((i) => {
          const dispatchTime = this.calculateProductDispatchTime(i);
          totDispatchTimeInMinutes = totDispatchTimeInMinutes + dispatchTime;

          return {
            ...i,
            preparationTime: this.getProductPreparationTime(i),
            cookingTime: this.getProductCookingTime(i),
            dispatchTime,
          };
        }),
        isDelivery: o.Bairro !== "" ? true : false,
        isTaglio:
          o.Itens.filter((i) => i.Descricao.includes("Taglio")).length > 0
            ? true
            : false,
        totDispatchTimeInMinutes,
        // pizzaSizeAmount: o.Itens.map((i) => {
        //   let mediumAmount = 0;
        //   let largeAmount = 0;

        //   if (i.IdProduto === 18) {
        //     mediumAmount = mediumAmount++;
        //   }

        //   if (i.IdProduto === 19) {
        //     largeAmount = largeAmount++;
        //   }

        //   return {
        //     mediumAmount,
        //     largeAmount,
        //   };
        // }),
      };
    });
  }

  async getOrdersOpenedWithDiffTime(): Promise<MogoOrderWithDiffTime[]> {
    const [err, ordersResponse] = await tryit(this.getOrdersOpened());

    const ordersRes = ordersResponse?.filter(
      (o: MogoBaseOrder) => o.isTaglio === false
    );

    if (err) {
      throw err;
    }

    if (!Array.isArray(ordersRes)) {
      return [];
    }

    /** START get settings */
    const settings = await this.settings.findSettingsByContext(
      "order-timeline-segmentation-delivery-time"
    );

    let maxDeliveryTimeInMinutesSettings: Setting | undefined;
    let maxPickUpTimeInMinutesSettings: Setting | undefined;

    if (settings) {
      maxDeliveryTimeInMinutesSettings = settings.find(
        (o: Setting) => o.name === "maxTimeDeliveryMinutes"
      );
      maxPickUpTimeInMinutesSettings = settings.find(
        (o: Setting) => o.name === "maxTimePickUpMinutes"
      );
    }
    /** END get settings */

    return ordersRes.map((o: MogoBaseOrder) => {
      if (!o.DataPedido || !o.HoraPedido) {
        return {
          ...o,
          deliveryTimeExpected: {
            fulldate: null,
            fulldateString: null,
            timeString: null,
          },
          diffOrderDateTimeToNow: {
            minutes: 0,
            timeString: null,
          },
          diffDeliveryDateTimeToNow: {
            minutes: 0,
            timeString: null,
          },
        };
      }

      const deliveryDateTimeExpected = this.calculateDeliveryTime(o, {
        maxDeliveryTimeInMinutes: Number(
          maxDeliveryTimeInMinutesSettings?.value || 0
        ),
        maxPickUpTimeInMinutes: Number(
          maxPickUpTimeInMinutesSettings?.value || 0
        ),
      });

      const orderDateTime = this._createDayjsObject(o.DataPedido, o.HoraPedido);

      /** Diff calculation */
      const now = dayjs().subtract(this.serverTimezoneOffset, "hours");

      const diffMinutesOrderDateTimeToNow = now.diff(orderDateTime, "minute");
      const diffDeliveryDateTimeToNowMinutes = deliveryDateTimeExpected.diff(
        now,
        "m"
      );

      // console.log({
      //   now: now.format("DD/MM/YYYY HH:mm:ss"),
      //   deliveryDateTimeExpected: deliveryDateTimeExpected.format(
      //     "DD/MM/YYYY HH:mm:ss"
      //   ),
      //   orderDateTime: orderDateTime.format("DD/MM/YYYY HH:mm:ss"),
      //   diffOrderDateTimeToNow: {
      //     minutes: diffMinutesOrderDateTimeToNow,
      //     timeString: convertMinutesToHHMM(diffMinutesOrderDateTimeToNow),
      //   },
      //   diffDeliveryDateTimeToNow: {
      //     minutes: diffDeliveryDateTimeToNowMinutes,
      //     timeString: convertMinutesToHHMM(diffDeliveryDateTimeToNowMinutes),
      //   },
      // });

      return {
        ...o,
        deliveryTimeExpected: {
          fulldate: deliveryDateTimeExpected,
          fulldateString: deliveryDateTimeExpected.format(
            "DD/MM/YYYY HH:mm:ss"
          ),
          timeString: deliveryDateTimeExpected.format("HH:mm"),
        },
        diffOrderDateTimeToNow: {
          minutes: diffMinutesOrderDateTimeToNow,
          timeString: convertMinutesToHHMM(diffMinutesOrderDateTimeToNow),
        },
        diffDeliveryDateTimeToNow: {
          minutes: diffDeliveryDateTimeToNowMinutes,
          timeString: convertMinutesToHHMM(diffDeliveryDateTimeToNowMinutes),
        },
      };
    });
  }

  calculateDeliveryTime(
    order: MogoBaseOrder,
    settings: {
      maxDeliveryTimeInMinutes: number;
      maxPickUpTimeInMinutes: number;
    }
  ) {
    const dayjsOrderDateTime = this._createDayjsObject(
      order.DataPedido,
      order.HoraPedido
    );

    // console.log({
    //   source: "calculateDeliveryTime",
    //   dayjsOrderDateTime: dayjsOrderDateTime.format("DD/MM/YYYY HH:mm:ss"),
    //   isDelivery: order.isDelivery,
    // });

    if (order.isDelivery === true) {
      return dayjsOrderDateTime.add(
        Number(settings.maxDeliveryTimeInMinutes) || 0,
        "m"
      );
    }

    return dayjsOrderDateTime.add(
      Number(settings.maxPickUpTimeInMinutes) || 0,
      "m"
    );
  }

  calculateProductDispatchTime(item: MogoOrderItem) {
    const preparationTime = this.getProductPreparationTime(item);

    const cookingTime = this.getProductCookingTime(item);

    return preparationTime + cookingTime;
  }

  getProductPreparationTime(item: MogoOrderItem) {
    const idProdutoStr = String(item.IdProduto) as
      | MogoPizzaFamiliaId
      | MogoPizzaMediaId;

    return this.timeConfig[idProdutoStr]?.preparationTime || 0;
  }

  getProductCookingTime(item: MogoOrderItem) {
    const idProdutoStr = String(item.IdProduto) as
      | MogoPizzaFamiliaId
      | MogoPizzaMediaId;

    return this.timeConfig[idProdutoStr]?.cookingTime || 0;
  }

  private _createDayjsObject(mogoDate: string, mogoTime: string) {
    const [day, month, year] = mogoDate.split(/\/| /);
    const parsedDate = `${year}-${month}-${day}`;

    // Combine date and time strings
    const dateTimeString = `${parsedDate} ${mogoTime}`;

    // console.log({
    //   name: "_createDayjsObject",
    //   localDateTime: dayjs(dateTimeString).format("DD/MM/YYYY HH:mm:ss"),
    //   dateTimeString,
    // });

    return dayjs(dateTimeString);
  }
}

const envVar = process.env?.MOGO_MOCK_ORDERS_DELAYS_TIMELINE;
let mock = false;

if (envVar === "true") {
  mock = true;
}

const mogoHttpClient = mock ? new MogoHttpClientMock() : new MogoHttpClient();

const mogoEntity = new MogoEntity({
  httpClient: mogoHttpClient,
  settings: settingPrismaEntity,
  serverTimezoneOffset: Number(process.env?.SERVER_TIMEZONE_OFFSET || 0),
});

export default mogoEntity;
