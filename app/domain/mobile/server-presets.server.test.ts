import { beforeEach, expect, it, vi } from "vitest";
const settings = vi.hoisted(() => ({ findFirst: vi.fn(), create: vi.fn() }));
vi.mock("~/lib/prisma/client.server", () => ({
  default: { setting: settings },
}));
import {
  ensureServerPresetsSetting,
  readServerPresets,
} from "./server-presets.server";
import { DEFAULT_SERVER_PRESETS } from "../../../shared/mobile/server-presets";
import { loader } from "../../routes/api.mobile.servers";

beforeEach(() => vi.resetAllMocks());

it("cria os padrões na lista geral e preserva a configuração existente", async () => {
  settings.findFirst.mockResolvedValueOnce(null);
  await ensureServerPresetsSetting();
  const { data } = settings.create.mock.calls[0][0];
  expect(data).toMatchObject({
    context: "mobile",
    name: "login.servers",
    type: "json",
  });
  expect(JSON.parse(data.value)).toEqual(DEFAULT_SERVER_PRESETS);
  settings.create.mockClear();
  settings.findFirst.mockResolvedValueOnce({ id: "existing" });
  await ensureServerPresetsSetting();
  expect(settings.create).not.toHaveBeenCalled();
});

it("expõe apenas nomes e origens configuradas, sem escrever no banco", async () => {
  settings.findFirst.mockResolvedValue({
    value: JSON.stringify([
      {
        name: "Rede local",
        url: "http://192.168.1.10:3000/",
        secret: "never expose",
      },
    ]),
  });
  const response = await loader();
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await response.json()).toEqual({
    servers: [{ name: "Rede local", url: "http://192.168.1.10:3000" }],
  });
  expect(settings.create).not.toHaveBeenCalled();
});

it("retorna padrões quando o setting não existe ou contém dados inválidos", async () => {
  for (const setting of [null, { value: "invalid json" }, { value: "[]" }]) {
    settings.findFirst.mockResolvedValueOnce(setting);
    expect(await readServerPresets()).toEqual(DEFAULT_SERVER_PRESETS);
  }
});
