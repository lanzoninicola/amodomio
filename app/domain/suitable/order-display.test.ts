import { expect, it } from "vitest";
import { suitableCommandNumber, suitableDisplayNumber } from "./order-display";
it("normalizes display numbers without inventing an internal ID fallback", () => {
  expect(suitableDisplayNumber(" #1 ")).toBe("1");
  expect(suitableDisplayNumber(1)).toBe("1");
  expect(suitableDisplayNumber(null)).toBeNull();
  expect(suitableDisplayNumber(undefined)).toBeNull();
  expect(suitableDisplayNumber(" ")).toBeNull();
});

it("uses the display number as the KDS command number and rejects invalid values", () => {
  expect(suitableCommandNumber("1")).toBe(1);
  expect(suitableCommandNumber("#1")).toBe(1);
  for (const value of [undefined, null, "", "abc", "1.5", "0", "-1", "2147483648"])
    expect(suitableCommandNumber(value)).toBeNull();
});
