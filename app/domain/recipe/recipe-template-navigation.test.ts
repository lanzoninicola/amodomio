import { expect, it } from "vitest";
import {
  getRecipeTemplateSearch,
  readRecipeTemplateConfiguration,
} from "./recipe-template-navigation";

it("preserves decimal proportions and individual units across navigation", () => {
  const configuration = {
    scaleFactor: 0.5325,
    selectedUnits: { flour: "G", water: "ML" },
  };
  expect(
    readRecipeTemplateConfiguration(
      new URLSearchParams(getRecipeTemplateSearch(configuration))
    )
  ).toEqual(configuration);
});

it("opens direct links with the base recipe quantities", () => {
  expect(readRecipeTemplateConfiguration(new URLSearchParams())).toEqual({
    scaleFactor: 1,
    selectedUnits: {},
  });
});

it.each(["0", "-1", "NaN", "Infinity"])(
  "rejects invalid proportions %s",
  (scaleFactor) => {
    expect(() =>
      readRecipeTemplateConfiguration(new URLSearchParams({ scaleFactor }))
    ).toThrow();
  }
);

it.each(["null", "[]", "broken", '{"flour":5}'])(
  "rejects malformed units %s",
  (selectedUnits) => {
    expect(() =>
      readRecipeTemplateConfiguration(new URLSearchParams({ selectedUnits }))
    ).toThrow();
  }
);
