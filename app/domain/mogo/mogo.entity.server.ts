import tryit from "~/utils/try-it";
import {
  MogoBaseOrder,
  MogoHttpClientInterface,
  MogoOrderWithDiffTime,
} from "./types";
import dayjs from "dayjs";
import { setup } from "~/lib/dayjs";
import MogoHttpClient from "./mogo-http-client.server";
import MogoHttpClientMock from "./mogo-http-client.mock.server";
import convertMinutesToHHMM from "~/utils/convert-minutes-to-hhmm";

interface MogoEntityProps {
  httpClient: MogoHttpClientInterface;
}

class MogoEntity {
  httpClient: MogoHttpClientInterface;

  constructor({ httpClient }: MogoEntityProps) {
    setup();

    this.httpClient = httpClient;
  }

  async getOrdersOpened(): Promise<MogoOrderWithDiffTime[]> {
    const [err, ordersRes] = await tryit(this.httpClient.getOrdersOpened());

    if (err) {
      throw err;
    }

    if (!Array.isArray(ordersRes)) {
      return [];
    }

    const now = dayjs();

    const orders = ordersRes.map((o: MogoBaseOrder) => {
      if (!o.DataPedido || !o.HoraPedido || !o.HoraEntregaTxt) {
        return {
          ...o,
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

      const parsedDate = this._convertMogoDateString(o.DataPedido);
      const parsedTime = this._convertMogoTimeString(o.HoraPedido);
      const parsedDeliveryExpectedTime = this._convertMogoTimeString(
        o.HoraEntregaTxt
      );

      const orderDateTime = this._formatMogoDateTime(parsedDate, parsedTime);

      const orderDeliveryDateTime = this._formatMogoDateTime(
        parsedDate,
        parsedDeliveryExpectedTime
      );

      const diffMinutesOrderDateTimeToNow = now.diff(orderDateTime, "minute");
      const diffMinutesDeliveryDateTimeToNow = now.diff(
        orderDeliveryDateTime,
        "minute"
      );

      return {
        ...o,
        diffOrderDateTimeToNow: {
          minutes: diffMinutesOrderDateTimeToNow,
          timeString: convertMinutesToHHMM(diffMinutesOrderDateTimeToNow),
        },
        diffDeliveryDateTimeToNow: {
          minutes: diffMinutesDeliveryDateTimeToNow,
          timeString: convertMinutesToHHMM(diffMinutesDeliveryDateTimeToNow),
        },
      };
    });

    return orders;
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

const mock = true;

const mogoHttpClient = mock ? new MogoHttpClientMock() : new MogoHttpClient();

const mogoEntity = new MogoEntity({
  httpClient: mogoHttpClient,
});

export default mogoEntity;
