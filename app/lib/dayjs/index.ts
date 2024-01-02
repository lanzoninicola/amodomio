import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

const setup = (userTimezone = "America/Bahia") => {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.tz.setDefault(userTimezone);
};

/**
 *
 * @returns string date formatted DD/MM/YYYY
 */
export const now = (format: string = "DD/MM/YYYY") => {
  setup();
  return dayjs().format(format);
};

export const nowWithTime = () => {
  setup();
  return dayjs().format("DD/MM/YYYY HH:mm:ss");
};

export const nowMergedString = () => {
  setup();
  return dayjs().format("YYYYMMDD");
};

export const formatDateWithTime = (date: Date | string) => {
  setup();
  return dayjs(date).format("DD/MM/YYYY HH:mm:ss");
};

export const formatDateOnyTime = (date: Date | string) => {
  setup();
  return dayjs(date).format("HH:mm:ss");
};
