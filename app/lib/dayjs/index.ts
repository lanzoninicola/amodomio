import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import localizedFormat from "dayjs/plugin/localizedFormat";
import advancedFormat from "dayjs/plugin/advancedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isBetween from "dayjs/plugin/isBetween";
import isYesterday from "dayjs/plugin/isYesterday";
import isToday from "dayjs/plugin/isToday";
import isTomorrow from "dayjs/plugin/isTomorrow";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";

//github.com/iamkun/dayjs/issues/1379#issuecomment-1007052536

https: dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(isYesterday);
dayjs.extend(isToday);
dayjs.extend(isTomorrow);
dayjs.extend(relativeTime);

dayjs.locale("pt-br");

/**
 *
 * @returns string date formatted DD/MM/YYYY
 */
export const now = (format: string = "DD/MM/YYYY") => {
  return dayjs().format(format);
};

export const nowUTC = (format?: string) => {
  dayjs.extend(utc);
  if (format) {
    return dayjs.utc().format(format);
  }

  return dayjs.utc();
};

export const nowWithTime = () => {
  return dayjs().format("DD/MM/YYYY HH:mm:ss");
};

export const nowMergedString = () => {
  return dayjs().format("YYYYMMDD");
};

export const formatDateWithTime = (date: Date | string) => {
  return dayjs(date).format("DD/MM/YYYY HH:mm:ss");
};

export const formatDateOnyTime = (date: Date | string) => {
  return dayjs(date).format("HH:mm:ss");
};

export {
  dayjs,
  Dayjs,
  utc,
  timezone,
  localizedFormat,
  advancedFormat,
  customParseFormat,
  isBetween,
  isYesterday,
  isToday,
  isTomorrow,
  relativeTime,
};
