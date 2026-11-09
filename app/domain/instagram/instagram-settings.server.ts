import prismaClient from "~/lib/prisma/client.server";

export const INSTAGRAM_SETTINGS_CONTEXT = "instagram";

export const INSTAGRAM_APP_ID_SETTING = "meta.app.id";
export const INSTAGRAM_CALLBACK_URL_SETTING = "meta.facebook.callback.url";
export const INSTAGRAM_LOGIN_CONFIG_ID_SETTING =
  "meta.facebook.login.config.id";
export const INSTAGRAM_FACEBOOK_PAGE_ID_SETTING = "meta.facebook.page.id";
export const INSTAGRAM_GRAPH_API_VERSION_SETTING = "meta.graph.api.version";
export const INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS_SETTING =
  "meta.story.status.maxAttempts";
export const INSTAGRAM_STORY_STATUS_INTERVAL_MS_SETTING =
  "meta.story.status.intervalMs";

export const DEFAULT_INSTAGRAM_GRAPH_API_VERSION = "v25.0";
export const DEFAULT_INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS = "12";
export const DEFAULT_INSTAGRAM_STORY_STATUS_INTERVAL_MS = "1000";

type InstagramSettingDefinition = {
  name: string;
  type: "string" | "int";
  defaultValue: string;
  envName?: string;
};

const DEFINITIONS: InstagramSettingDefinition[] = [
  {
    name: INSTAGRAM_APP_ID_SETTING,
    type: "string",
    defaultValue: "",
    envName: "META_APP_ID",
  },
  {
    name: INSTAGRAM_CALLBACK_URL_SETTING,
    type: "string",
    defaultValue: "",
    envName: "META_FACEBOOK_CALLBACK_URL",
  },
  {
    name: INSTAGRAM_LOGIN_CONFIG_ID_SETTING,
    type: "string",
    defaultValue: "",
    envName: "META_FACEBOOK_LOGIN_CONFIG_ID",
  },
  {
    name: INSTAGRAM_FACEBOOK_PAGE_ID_SETTING,
    type: "string",
    defaultValue: "",
    envName: "META_FACEBOOK_PAGE_ID",
  },
  {
    name: INSTAGRAM_GRAPH_API_VERSION_SETTING,
    type: "string",
    defaultValue: DEFAULT_INSTAGRAM_GRAPH_API_VERSION,
    envName: "META_GRAPH_API_VERSION",
  },
  {
    name: INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS_SETTING,
    type: "int",
    defaultValue: DEFAULT_INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS,
    envName: "META_STORY_STATUS_MAX_ATTEMPTS",
  },
  {
    name: INSTAGRAM_STORY_STATUS_INTERVAL_MS_SETTING,
    type: "int",
    defaultValue: DEFAULT_INSTAGRAM_STORY_STATUS_INTERVAL_MS,
    envName: "META_STORY_STATUS_INTERVAL_MS",
  },
];

function envValue(name?: string) {
  return name ? String(process.env[name] || "").trim() : "";
}

function initialValue(definition: InstagramSettingDefinition) {
  return envValue(definition.envName) || definition.defaultValue;
}

function normalizeGraphApiVersion(value: string) {
  return (value || DEFAULT_INSTAGRAM_GRAPH_API_VERSION)
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function normalizePositiveInt(
  value: string,
  fallback: string,
  minimum: number
) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return String(parsed);
}

function byName(settings: Array<{ name: string; value: string }>) {
  return settings.reduce<Map<string, string>>((acc, setting) => {
    acc.set(setting.name, setting.value);
    return acc;
  }, new Map());
}

async function ensureSetting(definition: InstagramSettingDefinition) {
  const current = await prismaClient.setting.findFirst({
    where: {
      context: INSTAGRAM_SETTINGS_CONTEXT,
      name: definition.name,
    },
    orderBy: { createdAt: "desc" },
  });

  if (current) return current;

  return prismaClient.setting.create({
    data: {
      context: INSTAGRAM_SETTINGS_CONTEXT,
      name: definition.name,
      type: definition.type,
      value: initialValue(definition),
      createdAt: new Date(),
    },
  });
}

export async function ensureInstagramSettings() {
  const settings = await Promise.all(DEFINITIONS.map(ensureSetting));
  return byName(settings);
}

export async function getInstagramSettings() {
  const settings = await ensureInstagramSettings();
  return {
    appId: String(settings.get(INSTAGRAM_APP_ID_SETTING) || "").trim(),
    callbackUrl: String(
      settings.get(INSTAGRAM_CALLBACK_URL_SETTING) || ""
    ).trim(),
    configId: String(
      settings.get(INSTAGRAM_LOGIN_CONFIG_ID_SETTING) || ""
    ).trim(),
    facebookPageId: String(
      settings.get(INSTAGRAM_FACEBOOK_PAGE_ID_SETTING) || ""
    ).trim(),
    graphApiVersion: normalizeGraphApiVersion(
      String(
        settings.get(INSTAGRAM_GRAPH_API_VERSION_SETTING) ||
          DEFAULT_INSTAGRAM_GRAPH_API_VERSION
      )
    ),
    storyStatusMaxAttempts: Number(
      normalizePositiveInt(
        String(
          settings.get(INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS_SETTING) ||
            DEFAULT_INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS
        ),
        DEFAULT_INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS,
        1
      )
    ),
    storyStatusIntervalMs: Number(
      normalizePositiveInt(
        String(
          settings.get(INSTAGRAM_STORY_STATUS_INTERVAL_MS_SETTING) ||
            DEFAULT_INSTAGRAM_STORY_STATUS_INTERVAL_MS
        ),
        DEFAULT_INSTAGRAM_STORY_STATUS_INTERVAL_MS,
        250
      )
    ),
  };
}

export async function saveInstagramSettings(input: {
  appId: string;
  callbackUrl: string;
  configId: string;
  facebookPageId: string;
  graphApiVersion: string;
  storyStatusMaxAttempts: string;
  storyStatusIntervalMs: string;
}) {
  const values = new Map<string, string>([
    [INSTAGRAM_APP_ID_SETTING, input.appId.trim()],
    [INSTAGRAM_CALLBACK_URL_SETTING, input.callbackUrl.trim()],
    [INSTAGRAM_LOGIN_CONFIG_ID_SETTING, input.configId.trim()],
    [INSTAGRAM_FACEBOOK_PAGE_ID_SETTING, input.facebookPageId.trim()],
    [
      INSTAGRAM_GRAPH_API_VERSION_SETTING,
      normalizeGraphApiVersion(input.graphApiVersion),
    ],
    [
      INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS_SETTING,
      normalizePositiveInt(
        input.storyStatusMaxAttempts,
        DEFAULT_INSTAGRAM_STORY_STATUS_MAX_ATTEMPTS,
        1
      ),
    ],
    [
      INSTAGRAM_STORY_STATUS_INTERVAL_MS_SETTING,
      normalizePositiveInt(
        input.storyStatusIntervalMs,
        DEFAULT_INSTAGRAM_STORY_STATUS_INTERVAL_MS,
        250
      ),
    ],
  ]);

  await Promise.all(
    DEFINITIONS.map(async (definition) => {
      const value = values.get(definition.name) ?? definition.defaultValue;
      const current = await prismaClient.setting.findFirst({
        where: {
          context: INSTAGRAM_SETTINGS_CONTEXT,
          name: definition.name,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!current) {
        await prismaClient.setting.create({
          data: {
            context: INSTAGRAM_SETTINGS_CONTEXT,
            name: definition.name,
            type: definition.type,
            value,
            createdAt: new Date(),
          },
        });
        return;
      }

      await prismaClient.setting.update({
        where: { id: current.id },
        data: {
          type: definition.type,
          value,
        },
      });
    })
  );
}
