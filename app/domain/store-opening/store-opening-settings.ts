export const STORE_OPENING_CONTEXT = "store-opening-hours";
export const DEFAULT_STORE_OPENING = {
  openDays: [0, 3, 4, 5, 6],
  start: 1800,
  end: 2200,
};

export type StoreOpeningScheduleDay = {
  day: number;
  enabled: boolean;
  start: number;
  end: number;
  rangeDigits: string;
};

export type StoreOpeningStatus = {
  isOpen: boolean;
  day: number;
  nowTime: number;
  start: number;
  end: number;
  enabled: boolean;
};

type TimeParts = {
  day: number;
  nowTime: number;
};

const TIME_RANGE_LENGTH = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseBooleanSetting(value: string | null | undefined) {
  if (value === undefined || value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

function normalizeTimeDigits(raw: string, fallback: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 2) return fallback;

  const hours = clamp(Number(digits.slice(0, 2) || "0"), 0, 23);
  const minutes = clamp(Number(digits.slice(2, 4) || "0"), 0, 59);

  return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
}

export function buildRangeDigitsFromNumbers(start: number, end: number) {
  return `${String(start).padStart(4, "0")}${String(end).padStart(4, "0")}`;
}

export function normalizeRangeDigits(raw: string | null | undefined, fallbackRange: string) {
  const digits = (raw ?? "").replace(/\D/g, "").slice(0, TIME_RANGE_LENGTH);
  if (digits.length < TIME_RANGE_LENGTH) {
    return fallbackRange;
  }

  const start = normalizeTimeDigits(digits.slice(0, 4), fallbackRange.slice(0, 4));
  const end = normalizeTimeDigits(digits.slice(4, 8), fallbackRange.slice(4, 8));

  return `${start}${end}`;
}

export function rangeDigitsToNumbers(
  rangeDigits: string,
  fallbackStart: number,
  fallbackEnd: number
) {
  if (rangeDigits.length !== TIME_RANGE_LENGTH) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const start = Number(rangeDigits.slice(0, 4));
  const end = Number(rangeDigits.slice(4, 8));

  return {
    start: Number.isFinite(start) ? start : fallbackStart,
    end: Number.isFinite(end) ? end : fallbackEnd,
  };
}

function formatTimePartial(digits: string) {
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function formatRangeDigits(digits: string) {
  const clean = digits.replace(/\D/g, "").slice(0, TIME_RANGE_LENGTH);
  if (!clean) return "";

  const start = formatTimePartial(clean.slice(0, 4));
  const end = clean.length > 4 ? formatTimePartial(clean.slice(4)) : "";

  return end ? `${start} - ${end}` : start;
}

export function buildStoreOpeningSchedule(params: {
  settings: Map<string, string>;
  fallbackOpenDays: number[];
  fallbackStart: number;
  fallbackEnd: number;
}) {
  const fallbackRange = buildRangeDigitsFromNumbers(
    params.fallbackStart,
    params.fallbackEnd
  );

  return Array.from({ length: 7 }, (_, day) => {
    const enabledKey = `day-${day}-enabled`;
    const rangeKey = `day-${day}-range`;

    const enabledRaw = params.settings.get(enabledKey);
    const rangeRaw = params.settings.get(rangeKey);

    const enabled =
      enabledRaw !== undefined
        ? parseBooleanSetting(enabledRaw)
        : params.fallbackOpenDays.includes(day);

    const rangeDigits = normalizeRangeDigits(rangeRaw, fallbackRange);
    const { start, end } = rangeDigitsToNumbers(
      rangeDigits,
      params.fallbackStart,
      params.fallbackEnd
    );

    return {
      day,
      enabled,
      start,
      end,
      rangeDigits,
    };
  });
}

function getTimePartsInTimeZone(now: Date, timeZone?: string): TimeParts {
  if (!timeZone) {
    return {
      day: now.getDay(),
      nowTime: now.getHours() * 100 + now.getMinutes(),
    };
  }

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekdayMap: Record<string, number> = {
    dom: 0,
    seg: 1,
    ter: 2,
    qua: 3,
    qui: 4,
    sex: 5,
    sáb: 6,
  };

  const weekdayRaw = parts.find((part) => part.type === "weekday")?.value?.toLowerCase() || "";
  const day = weekdayMap[weekdayRaw] ?? now.getDay();
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? now.getHours());
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? now.getMinutes());

  return {
    day,
    nowTime: hour * 100 + minute,
  };
}

export function computeStoreOpeningStatus(
  schedule: StoreOpeningScheduleDay[],
  now: Date = new Date(),
  timeZone?: string
): StoreOpeningStatus {
  const { day, nowTime } = getTimePartsInTimeZone(now, timeZone);
  const entry = schedule.find((item) => item.day === day);

  if (!entry) {
    return {
      isOpen: false,
      day,
      nowTime,
      start: 0,
      end: 0,
      enabled: false,
    };
  }

  const isOpen =
    Boolean(entry.enabled) && nowTime >= entry.start && nowTime < entry.end;

  return {
    isOpen,
    day,
    nowTime,
    start: entry.start,
    end: entry.end,
    enabled: Boolean(entry.enabled),
  };
}
