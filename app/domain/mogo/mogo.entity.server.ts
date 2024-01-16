import tryit from "~/utils/try-it";
import {
  MogoBaseOrder,
  MogoHttpClientInterface,
  MogoOrderHttpResponse,
  MogoOrderWithDiffTime,
} from "./types";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import MogoHttpClient from "./mogo-http-client.server";
import MogoHttpClientMock from "./mogo-http-client.mock.server";
import convertMinutesToHHMM from "~/utils/convert-minutes-to-hhmm";
import {
  SettingEntityInterface,
  settingEntity,
} from "../setting/setting.entity.server";
import { Setting } from "../setting/setting.model.server";
import { setup } from "~/lib/dayjs";

interface MogoEntityProps {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;
}

class MogoEntity {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;

  constructor({ httpClient, settings }: MogoEntityProps) {
    // setup();

    this.httpClient = httpClient;
    this.settings = settings;
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

      // transform the mogo date and time in dayjs date time object
      const parsedDate = this._convertMogoDateString(o.DataPedido);
      const parsedTime = this._convertMogoTimeString(o.HoraPedido);
      const orderDateTimeUtc = this._formatMogoDateTime(
        parsedDate,
        parsedTime.utc
      );
      /** Diff calculation */
      const now = dayjs().tz().utc();
      let deliveryDateTimeExpectedUtc = dayjs().tz().utc();

      if (o.isDelivery === true) {
        deliveryDateTimeExpectedUtc = orderDateTimeUtc.add(
          Number(maxDeliveryTimeInMinutesSettings?.value) || 0,
          "m"
        );
      }

      if (o.isDelivery === false) {
        deliveryDateTimeExpectedUtc = orderDateTimeUtc.add(
          Number(maxCounterTimeInMinutesSettings?.value) || 0,
          "m"
        );
      }

      console.log({
        isDelivery: o.isDelivery,
        deliveryDateTimeExpectedUtc,
        orderDateTimeUtc,
      });

      const diffMinutesOrderDateTimeToNow = now.diff(
        orderDateTimeUtc,
        "minute"
      );
      const diffDeliveryDateTimeToNowMinutes = now.diff(
        deliveryDateTimeExpectedUtc,
        "m"
      );

      // console.log({
      //   fulldate: deliveryDateTimeExpectedUtc,
      //   fulldateString: deliveryDateTimeExpectedUtc.format(
      //     "DD/MM/YYYY HH:mm:ss"
      //   ),
      //   timeString: dayjs(deliveryDateTimeExpectedUtc).local().format("HH:mm"),
      //   timeStringUtc: deliveryDateTimeExpectedUtc.format("HH:mm"),
      // });

      const deliveryTimeExpectedLocal = dayjs(deliveryDateTimeExpectedUtc).tz(
        "America/Bahia"
      );

      return {
        ...o,
        deliveryTimeExpected: {
          fulldate: deliveryTimeExpectedLocal,
          fulldateString: deliveryTimeExpectedLocal.format(
            "DD/MM/YYYY HH:mm:ss"
          ),
          timeString: deliveryTimeExpectedLocal.format("HH:mm"),
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

  /**
   * Create a single datetime object from separated date and time dayjs object
   *
   * Example:
   * Mogo returns the "Data Pedido" and "Hora Pedido" in two separated fields
   * "DataPedido": "04/01/2024 00:00:00",
   * "HoraPedido": "20:50:50",
   *
   * First, I need to convert the two fields in a DayJS object then,
   * this function will merge the separeted information in a single date object
   * "dateTimeObject": "04/01/2024 20:50:50"
   *
   * @param parsedDate
   * @param parsedTime
   * @returns
   */
  private _formatMogoDateTime(
    parsedDate: dayjs.Dayjs,
    parsedTime: dayjs.Dayjs
  ) {
    return parsedDate
      .set("hour", parsedTime.hour())
      .set("minute", parsedTime.minute())
      .set("second", parsedTime.second());
  }

  /**
   * Convert the date string of Mogo returned object in a DayJS object
   *
   * @param dateStr The data field in string format (ex. "04/01/2024 00:00:00")
   * @returns A DayJS object representing the "DataPedido" date string
   *
   */
  private _convertMogoDateString(dateStr: string) {
    const [day, month, year] = dateStr.split(/\/| /);
    const parsedDate = `${year}-${month}-${day}`;

    return dayjs(parsedDate, "DD/MM/YYYY HH:mm:ss");
  }

  /**
   * Convert the time string of Mogo returned object in a DayJS object
   *
   * @param timeStr The time field in string format (ex. "20:50:50")
   * @returns
   */
  private _convertMogoTimeString(timeStr: string) {
    const [hour, minute, second] = timeStr.split(":");
    const timeStringFormatted = `2000-01-01 ${hour}:${minute}:${second}`;

    return {
      locale: dayjs(timeStringFormatted, "HH:mm:ss"),
      utc: dayjs.tz(timeStringFormatted, "America/Bahia").utc(),
    };
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
