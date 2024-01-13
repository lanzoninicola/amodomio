import tryit from "~/utils/try-it";
import {
  MogoBaseOrder,
  MogoHttpClientInterface,
  MogoOrderHttpResponse,
  MogoOrderWithDiffTime,
} from "./types";
import dayjs from "dayjs";
import { setup } from "~/lib/dayjs";
import MogoHttpClient from "./mogo-http-client.server";
import MogoHttpClientMock from "./mogo-http-client.mock.server";
import convertMinutesToHHMM from "~/utils/convert-minutes-to-hhmm";
import {
  SettingEntityInterface,
  settingEntity,
} from "../setting/setting.entity.server";
import { serverError } from "~/utils/http-response.server";
import { Setting } from "../setting/setting.model.server";

interface MogoEntityProps {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;
}

class MogoEntity {
  httpClient: MogoHttpClientInterface;
  settings: SettingEntityInterface;

  constructor({ httpClient, settings }: MogoEntityProps) {
    setup();

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
    let maxCountertimeInMinutesSettings: Setting | undefined;

    if (settings) {
      maxDeliveryTimeInMinutesSettings = settings.find(
        (o: Setting) => o.name === "maxTimeDeliveryMinutes"
      );
      maxCountertimeInMinutesSettings = settings.find(
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
      const orderDateTime = this._formatMogoDateTime(parsedDate, parsedTime);

      /** Diff calculation */
      const now = dayjs();
      let deliveryDateTimeExpected = now;

      if (o.isDelivery) {
        deliveryDateTimeExpected = orderDateTime.add(
          Number(maxDeliveryTimeInMinutesSettings?.value) || 0,
          "m"
        );
      }

      if (o.isDelivery === false) {
        deliveryDateTimeExpected = orderDateTime.add(
          Number(maxCountertimeInMinutesSettings?.value) || 0,
          "m"
        );
      }

      const diffMinutesOrderDateTimeToNow = now.diff(orderDateTime, "minute");
      const diffDeliveryDateTimeToNowMinutes = now.diff(
        deliveryDateTimeExpected,
        "m"
      );

      // console.log({
      //   nowString: now.format("DD/MM/YYYY hh:mm:ss"),
      //   deliveryDateTimeExpected: deliveryDateTimeExpected.format(
      //     "DD/MM/YYYY HH:mm:ss"
      //   ),
      //   diffDeliveryDateTimeToNowMinutes,
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

    return dayjs(parsedDate, "DD/MM/YYYY HH:mm:ss", "pt-br");
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

    return dayjs(timeStringFormatted, "HH:mm:ss", "pt-br");
  }
}

const mock = false;

const mogoHttpClient = mock ? new MogoHttpClientMock() : new MogoHttpClient();

const mogoEntity = new MogoEntity({
  httpClient: mogoHttpClient,
  settings: settingEntity,
});

export default mogoEntity;
