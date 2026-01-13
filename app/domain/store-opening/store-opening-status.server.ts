import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import {
  buildStoreOpeningSchedule,
  computeStoreOpeningStatus,
  DEFAULT_STORE_OPENING,
  STORE_OPENING_CONTEXT,
  type StoreOpeningScheduleDay,
} from "./store-opening-settings";

export async function loadStoreOpeningSchedule(): Promise<StoreOpeningScheduleDay[]> {
  try {
    const settings = await settingPrismaEntity.findAllByContext(STORE_OPENING_CONTEXT);
    const settingsMap = new Map(settings.map((setting) => [setting.name, setting.value]));

    return buildStoreOpeningSchedule({
      settings: settingsMap,
      fallbackOpenDays: DEFAULT_STORE_OPENING.openDays,
      fallbackStart: DEFAULT_STORE_OPENING.start,
      fallbackEnd: DEFAULT_STORE_OPENING.end,
    });
  } catch (error) {
    console.warn("[store-opening] failed to load schedule, using defaults", {
      error: (error as any)?.message,
    });
    return buildStoreOpeningSchedule({
      settings: new Map(),
      fallbackOpenDays: DEFAULT_STORE_OPENING.openDays,
      fallbackStart: DEFAULT_STORE_OPENING.start,
      fallbackEnd: DEFAULT_STORE_OPENING.end,
    });
  }
}

export async function getStoreOpeningStatus(now: Date = new Date()) {
  const schedule = await loadStoreOpeningSchedule();
  const status = computeStoreOpeningStatus(schedule, now);
  return { status, schedule };
}
