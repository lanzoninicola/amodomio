import { describe, expect, it } from "vitest";
import {
  calculatePlan,
  resetPlanField,
  productionShortfallLevel,
  calculateRow,
  emptyPlan,
  parsePlan,
  planningDays,
  parseReferenceDate,
} from "./calculation";
describe("planejamento de massa", () => {
  it("reproduz o exemplo família", () => {
    expect(
      calculateRow({
        ...emptyPlan().family,
        previous: "10",
        todaySales: "9",
        production: "8",
        laterSales: "12",
      })
    ).toEqual({
      available: 10,
      balance: 1,
      needTomorrow: 0,
      gramsTomorrow: 10000,
      balanceTomorrow: 9,
      needLater: 3,
      gramsLater: 3750,
    });
  });
  it("reproduz média e preserva saldo negativo", () => {
    expect(
      calculateRow({
        ...emptyPlan().medium,
        previous: "18",
        todaySales: "29",
        production: "20",
        laterSales: "29",
      })
    ).toEqual({
      available: 18,
      balance: -11,
      needTomorrow: 11,
      gramsTomorrow: 8000,
      balanceTomorrow: 9,
      needLater: 20,
      gramsLater: 8000,
    });
  });
  it("inicia a produção pela necessidade e usa essa quantidade no saldo e na massa", () => {
    const result = calculateRow({
      ...emptyPlan().medium,
      todaySales: "2",
      tomorrowSales: "3",
      laterSales: "4",
    });
    expect(result).toMatchObject({
      balance: -2,
      needTomorrow: 5,
      gramsTomorrow: 2000,
      balanceTomorrow: 0,
      needLater: 4,
      gramsLater: 1600,
    });
  });
  it("respeita produção manual zero sem retornar à necessidade estimada", () => {
    const result = calculateRow({
      ...emptyPlan().medium,
      todaySales: "2",
      tomorrowSales: "3",
      laterSales: "4",
      production: "0",
      laterProduction: "0",
    });
    expect(result).toMatchObject({
      needTomorrow: 5,
      gramsTomorrow: 0,
      balanceTomorrow: -5,
      needLater: 9,
      gramsLater: 0,
    });
  });
  it("soma todos os tamanhos e aplica limite estrito de 22kg nos dois dias", () => {
    const plan = emptyPlan();
    plan.family.production = "16";
    plan.medium.production = "5";
    plan.family.laterSales = "32";
    plan.medium.laterSales = "10";
    expect(calculatePlan(plan)).toMatchObject({
      gramsTomorrow: 22000,
      gramsLater: 22000,
      overTomorrow: false,
      overLater: false,
    });
    plan.small.production = "1";
    plan.small.laterSales = "2";
    expect(calculatePlan(plan)).toMatchObject({
      gramsTomorrow: 22140,
      gramsLater: 22140,
      overTomorrow: true,
      overLater: true,
    });
    expect(calculatePlan(emptyPlan()).gramsTomorrow).toBe(0);
  });
  it("aplica pesos editados e restaura dados versionados", () => {
    const plan = emptyPlan();
    plan.individual.grams = "250";
    plan.individual.production = "2";
    expect(calculatePlan(plan).gramsTomorrow).toBe(500);
    expect(parsePlan(JSON.stringify({ version: 1, rows: plan }))).toEqual(plan);
    expect(parsePlan(null)).toEqual(emptyPlan());
    expect(() => parsePlan("null")).toThrow();
  });
  it("calcula dias no fuso de São Paulo, inclusive virada de ano", () => {
    expect(
      planningDays(new Date("2027-01-01T02:00:00Z")).map((day) => day.key)
    ).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(
      planningDays(new Date("2026-11-01T15:00:00Z")).map((day) => day.label)
    ).toEqual(["SÁBADO", "DOMINGO", "SEGUNDA", "TERÇA"]);
  });
});

it("recalcula os dias a partir de uma data escolhida e restaura a referência", () => {
  expect(planningDays("2026-11-04").map((day) => day.key)).toEqual([
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
  ]);
  expect(planningDays("2026-11-04")[1].label).toBe("QUARTA");
  expect(
    parseReferenceDate(JSON.stringify({ referenceDate: "2026-11-04" }))
  ).toBe("2026-11-04");
  expect(
    parseReferenceDate(JSON.stringify({ version: 1, rows: emptyPlan() }))
  ).toBeNull();
  expect(
    parseReferenceDate(JSON.stringify({ referenceDate: "2026-02-30" }))
  ).toBeNull();
  expect(
    parseReferenceDate(JSON.stringify({ referenceDate: null }))
  ).toBeNull();
});

it("permite definir produção em D+2, preserva a necessidade e respeita zero manual", () => {
  const plan = emptyPlan();
  plan.medium.laterSales = "10";
  expect(calculateRow(plan.medium)).toMatchObject({
    needLater: 10,
    gramsLater: 4000,
  });
  plan.medium.laterProduction = "15";
  expect(calculateRow(plan.medium)).toMatchObject({
    needLater: 10,
    gramsLater: 6000,
    balanceTomorrow: 0,
  });
  plan.medium.laterProduction = "60";
  expect(calculatePlan(plan)).toMatchObject({
    gramsLater: 24000,
    overLater: true,
  });
  expect(
    parsePlan(JSON.stringify({ version: 1, rows: plan })).medium.laterProduction
  ).toBe("60");
  plan.medium.laterProduction = "0";
  expect(calculateRow(plan.medium).gramsLater).toBe(0);
  const legacy = JSON.parse(JSON.stringify({ version: 1, rows: plan }));
  delete legacy.rows.medium.laterProduction;
  expect(parsePlan(JSON.stringify(legacy)).medium.laterProduction).toBe("");
});

it("gradua a falta de produção por percentual e mantém valores iguais ou maiores neutros", () => {
  expect(
    ["100", "90", "75", "50", "25", "0"].map((value) =>
      productionShortfallLevel(value, 100)
    )
  ).toEqual([0, 1, 2, 3, 4, 5]);
  expect(productionShortfallLevel("110", 100)).toBe(0);
  expect(productionShortfallLevel("", 100)).toBe(0);
  expect(productionShortfallLevel("0", 0)).toBe(0);
  expect(productionShortfallLevel("9", 10)).toBe(1);
  expect(productionShortfallLevel("74", 100)).toBe(3);
});

it("migra zeros automáticos antigos e preserva zeros manuais na versão nova", () => {
  const plan = emptyPlan();
  plan.family.production = "0";
  plan.family.laterProduction = "0";
  const legacy = parsePlan(JSON.stringify({ version: 1, rows: plan }));
  expect(legacy.family.production).toBe("");
  expect(legacy.family.laterProduction).toBe("");
  const current = parsePlan(JSON.stringify({ version: 2, rows: plan }));
  expect(current.family.production).toBe("0");
  expect(current.family.laterProduction).toBe("0");
});
it("recalcula a produção automática com a previsão e mantém quantidades manuais", () => {
  const row = { ...emptyPlan().family, tomorrowSales: "2", laterSales: "3" };
  expect(calculateRow(row)).toMatchObject({
    gramsTomorrow: 2500,
    balanceTomorrow: 0,
    gramsLater: 3750,
  });
  row.tomorrowSales = "4";
  expect(calculateRow(row).gramsTomorrow).toBe(5000);
  row.production = "3";
  expect(calculateRow(row)).toMatchObject({
    gramsTomorrow: 3750,
    balanceTomorrow: -1,
    gramsLater: 5000,
  });
  row.production = "";
  expect(calculateRow(row)).toMatchObject({
    gramsTomorrow: 5000,
    balanceTomorrow: 0,
    gramsLater: 3750,
  });
});

it("zera um formulário inteiro sem alterar os demais e restaura pesos válidos", () => {
  const plan = emptyPlan();
  plan.family.production = "8";
  plan.medium.production = "4";
  plan.family.incoming = "7";
  plan.family.grams = "1000";
  const reset = resetPlanField(plan, "production");
  expect(Object.values(reset).map((row) => row.production)).toEqual([
    "0",
    "0",
    "0",
    "0",
  ]);
  expect(reset.family.incoming).toBe("7");
  expect(reset.family.grams).toBe("1000");
  expect(plan.family.production).toBe("8");
  expect(resetPlanField(plan, "grams").family.grams).toBe("1250");
  expect(resetPlanField(plan, "grams").family.production).toBe("8");
});
