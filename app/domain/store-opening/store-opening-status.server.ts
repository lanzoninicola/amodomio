import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import {
  buildStoreOpeningSchedule,
  computeStoreOpeningStatus,
  DEFAULT_STORE_OPENING,
  STORE_OPENING_CONTEXT,
  type StoreOpeningScheduleDay,
} from "./store-opening-settings";

const OVERRIDE_SETTING_NAME = "override";
const OVERRIDE_VALUES = ["auto", "open", "closed"] as const;
export type StoreOpeningOverride = (typeof OVERRIDE_VALUES)[number];
const OFF_HOURS_MESSAGE_DEFAULT = "Estamos fora do horário. Voltamos em breve! 🍕";
const OFF_HOURS_RESPONSE_TYPE_DEFAULT = "text";
const OFF_HOURS_COOLDOWN_MINUTES_DEFAULT = 15;
const OFF_HOURS_AGGREGATION_SECONDS_DEFAULT = 20;

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

async function loadStoreOpeningOverride(): Promise<StoreOpeningOverride> {
  const existing = await settingPrismaEntity.findByContextAndName(
    STORE_OPENING_CONTEXT,
    OVERRIDE_SETTING_NAME
  );
  const raw = (existing?.value || "auto").toLowerCase();
  return OVERRIDE_VALUES.includes(raw as StoreOpeningOverride)
    ? (raw as StoreOpeningOverride)
    : "auto";
}

export async function setStoreOpeningOverride(override: StoreOpeningOverride) {
  const existing = await settingPrismaEntity.findByContextAndName(
    STORE_OPENING_CONTEXT,
    OVERRIDE_SETTING_NAME
  );
  if (existing?.id) {
    await settingPrismaEntity.update(existing.id, {
      value: override,
      type: "string",
    });
    return;
  }

  await settingPrismaEntity.create({
    context: STORE_OPENING_CONTEXT,
    name: OVERRIDE_SETTING_NAME,
    type: "string",
    value: override,
    createdAt: new Date(),
  });
}

export async function getOffHoursAutoresponderConfig() {
  const settings = await settingPrismaEntity.findAllByContext(STORE_OPENING_CONTEXT);
  const byName = new Map(settings.map((setting) => [setting.name, setting.value]));
  const responseTypeRaw = (byName.get("off-hours-response-type") || OFF_HOURS_RESPONSE_TYPE_DEFAULT).toLowerCase();
  const responseType = responseTypeRaw === "video" ? "video" : "text";
  const cooldownRaw = Number(byName.get("off-hours-cooldown-minutes") || OFF_HOURS_COOLDOWN_MINUTES_DEFAULT);
  const cooldownMinutes = Number.isFinite(cooldownRaw) && cooldownRaw > 0
    ? Math.floor(cooldownRaw)
    : OFF_HOURS_COOLDOWN_MINUTES_DEFAULT;
  const aggregationRaw = Number(byName.get("off-hours-aggregation-seconds") || OFF_HOURS_AGGREGATION_SECONDS_DEFAULT);
  const aggregationSeconds = Number.isFinite(aggregationRaw) && aggregationRaw >= 0
    ? Math.floor(aggregationRaw)
    : OFF_HOURS_AGGREGATION_SECONDS_DEFAULT;

  return {
    enabled: (byName.get("off-hours-enabled") ?? "true") === "true",
    message: byName.get("off-hours-message") || OFF_HOURS_MESSAGE_DEFAULT,
    responseType,
    video: byName.get("off-hours-video") || "",
    caption: byName.get("off-hours-video-caption") || "",
    cooldownMinutes,
    aggregationSeconds,
  };
}

export async function getStoreOpeningStatus(now: Date = new Date()) {
  const [schedule, override] = await Promise.all([
    loadStoreOpeningSchedule(),
    loadStoreOpeningOverride(),
  ]);
  const status = computeStoreOpeningStatus(schedule, now, "America/Sao_Paulo");

  const isOpen =
    override === "open" ? true : override === "closed" ? false : status.isOpen;

  return {
    status: {
      ...status,
      isOpen,
    },
    schedule,
    override,
  };
}
