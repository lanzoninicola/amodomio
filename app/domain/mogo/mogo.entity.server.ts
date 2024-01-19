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
}

class MogoEntity {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;

  constructor({ httpClient, settings }: MogoEntityProps) {
    this.httpClient = httpClient;
    this.settings = settings;

    dayjs.extend(utc);
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

      const deliveryDateTimeExpectedUtc = this.calculateDeliveryTime(
        o,
        {
          maxDeliveryTimeInMinutes: Number(
            maxDeliveryTimeInMinutesSettings?.value || 0
          ),
          maxCounterTimeInMinutes: Number(
            maxCounterTimeInMinutesSettings?.value || 0
          ),
        },
        {
          utc: true,
        }
      );

      const deliveryDateTimeExpectedLocal = dayjs(
        deliveryDateTimeExpectedUtc
      ).tz();

      const orderDateTimeUtc = this._createDayjsObject(
        o.DataPedido,
        o.HoraPedido,
        { utc: true }
      );

      /** Diff calculation */
      const now = dayjs().tz().utc();

      const diffMinutesOrderDateTimeToNow = now.diff(
        orderDateTimeUtc,
        "minute"
      );
      const diffDeliveryDateTimeToNowMinutes = now.diff(
        deliveryDateTimeExpectedUtc,
        "m"
      );

      // console.log({
      //   now: now.format("DD/MM/YYYY HH:mm:ss"),
      //   deliveryDateTimeExpectedUtc: deliveryDateTimeExpectedUtc.format(
      //     "DD/MM/YYYY HH:mm:ss"
      //   ),
      //   deliveryDateTimeExpectedLocal: deliveryDateTimeExpectedLocal.format(
      //     "DD/MM/YYYY HH:mm:ss"
      //   ),
      //   orderDateTimeUtc: orderDateTimeUtc.format("DD/MM/YYYY HH:mm:ss"),
      // });

      return {
        ...o,
        deliveryTimeExpected: {
          fulldate: deliveryDateTimeExpectedLocal,
          fulldateString: deliveryDateTimeExpectedLocal.format(
            "DD/MM/YYYY HH:mm:ss"
          ),
          timeString: deliveryDateTimeExpectedLocal.format("HH:mm"),
          timeStringUtc: deliveryDateTimeExpectedUtc.format("HH:mm"),
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
    },
    options?: {
      utc: boolean;
    }
  ) {
    const orderDateTime = this._createDayjsObject(
      order.DataPedido,
      order.HoraPedido,
      { utc: options?.utc || false }
    );

    if (order.isDelivery === true) {
      return orderDateTime.add(
        Number(settings.maxDeliveryTimeInMinutes) || 0,
        "m"
      );
    }

    return orderDateTime.add(
      Number(settings.maxCounterTimeInMinutes) || 0,
      "m"
    );
  }

  private _createDayjsObject(
    mogoDate: string,
    mogoTime: string,
    options: { utc: boolean }
  ) {
    const [day, month, year] = mogoDate.split(/\/| /);
    const parsedDate = `${year}-${month}-${day}`;

    // Combine date and time strings
    const dateTimeString = `${parsedDate} ${mogoTime}`;

    const dateTimeLocalTime = dayjs(dateTimeString);
    const dateTimeLocalTimeUTC = dayjs.utc(dateTimeLocalTime);

    if (options.utc === true) {
      return dateTimeLocalTimeUTC;
    }

    return dateTimeLocalTime;
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
});

export default mogoEntity;
