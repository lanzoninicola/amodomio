import { expect, it } from "vitest";
import { formatRecipeTvNumber } from "./recipe-tv-format";
it("limits displayed values to two decimals", () => {
  expect(formatRecipeTvNumber(1234.567)).toBe("1.234,57");
  expect(formatRecipeTvNumber(0.125)).toBe("0,13");
});
it("hides decimals with rounding when disabled", () => {
  expect(formatRecipeTvNumber(1234.567, false)).toBe("1.235");
  expect(formatRecipeTvNumber(12.34, false)).toBe("12");
});
it("does not force decimal places on whole numbers", () => {
  expect(formatRecipeTvNumber(12)).toBe("12");
  expect(formatRecipeTvNumber(12.5)).toBe("12,5");
});
