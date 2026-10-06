import { expect, it } from "vitest";
import { getEffectiveRoles } from "./user-access";

it("gives KDS administrators operator access without global administration", () => {
  expect(getEffectiveRoles({ roles: ["kdsAdmin"] })).toEqual([
    "kdsAdmin", "kdsOperator", "user",
  ]);
});

it("does not grant KDS administration to operators or existing global roles", () => {
  for (const role of ["user", "admin", "superAdmin", "kdsOperator"] as const) {
    expect(getEffectiveRoles({ roles: [role] })).not.toContain("kdsAdmin");
  }
});
