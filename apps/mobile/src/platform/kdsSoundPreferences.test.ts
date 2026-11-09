import { expect, it } from "vitest";
import { parseKdsSoundPreferences } from "./kdsSoundPreferences";
it("preserves current sound for missing or corrupt preferences", () => {
  for (const raw of [null, "invalid", "null", "{}"])
    expect(parseKdsSoundPreferences(raw)).toEqual({ enabled: true, volume: 1 });
});
it("persists mute and clamps the audio volume", () => {
  expect(parseKdsSoundPreferences('{"enabled":false,"volume":0.35}')).toEqual({
    enabled: false,
    volume: 0.35,
  });
  expect(parseKdsSoundPreferences('{"volume":3}').volume).toBe(1);
  expect(parseKdsSoundPreferences('{"volume":-1}').volume).toBe(0);
});
