import tryit from "~/utils/try-it";
import {
  MogoBaseOrder,
  MogoHttpClientInterface,
  MogoOrderHttpResponse,
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

interface MogoEntityProps {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;
  // offset hours related to the deployment server
  serverTimezoneOffset: number;
}

class MogoEntity {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;
  serverTimezoneOffset: number;

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
      return {
        ...o,
        isDelivery: o.Bairro !== "" ? true : false,
      };
    });
  }

  async getOrdersOpenedWithDiffTime(): Promise<MogoOrderWithDiffTime[]> {
    const [err, ordersRes] = await tryit(this.getOrdersOpened());

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
    let maxCounterTimeInMinutesSettings: Setting | undefined;

    if (settings) {
      maxDeliveryTimeInMinutesSettings = settings.find(
        (o: Setting) => o.name === "maxTimeDeliveryMinutes"
      );
      maxCounterTimeInMinutesSettings = settings.find(
        (o: Setting) => o.name === "maxTimeCounterMinutes"
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
        maxCounterTimeInMinutes: Number(
          maxCounterTimeInMinutesSettings?.value || 0
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

      console.log({
        now: now.format("DD/MM/YYYY HH:mm:ss"),
        deliveryDateTimeExpected: deliveryDateTimeExpected.format(
          "DD/MM/YYYY HH:mm:ss"
        ),
        orderDateTime: orderDateTime.format("DD/MM/YYYY HH:mm:ss"),
        diffOrderDateTimeToNow: {
          minutes: diffMinutesOrderDateTimeToNow,
          timeString: convertMinutesToHHMM(diffMinutesOrderDateTimeToNow),
        },
        diffDeliveryDateTimeToNow: {
          minutes: diffDeliveryDateTimeToNowMinutes,
          timeString: convertMinutesToHHMM(diffDeliveryDateTimeToNowMinutes),
        },
      });

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
      maxCounterTimeInMinutes: number;
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
      Number(settings.maxCounterTimeInMinutes) || 0,
      "m"
    );
  }

  private _createDayjsObject(mogoDate: string, mogoTime: string) {
    const [day, month, year] = mogoDate.split(/\/| /);
    const parsedDate = `${year}-${month}-${day}`;

    // Combine date and time strings
    const dateTimeString = `${parsedDate} ${mogoTime}`;

    console.log({
      name: "_createDayjsObject",
      localDateTime: dayjs(dateTimeString).format("DD/MM/YYYY HH:mm:ss"),
      dateTimeString,
    });

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
  settings: settingEntity,
  serverTimezoneOffset: Number(process.env?.SERVER_TIMEZONE_OFFSET || 0),
});

export default mogoEntity;
