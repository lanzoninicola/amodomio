import { expect, it } from "vitest";
import { isDatabaseConnectivityError } from "./connectivity";

it("does not classify a missing connection function as a database outage", () => {
  expect(isDatabaseConnectivityError(new TypeError("__vite_ssr_import_4__.getZapiConnection is not a function"))).toBe(false);
  expect(isDatabaseConnectivityError(new Error("Instância WhatsApp desconectada"))).toBe(false);
});

it("recognizes actual database connection failures", () => {
  for (const code of ["P1001", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH"]) {
    expect(isDatabaseConnectivityError({ code })).toBe(true);
  }
  for (const message of ["Can't reach database server", "connect ECONNREFUSED 127.0.0.1:5432", "Connection terminated unexpectedly", "Unable to connect to the database"]) {
    expect(isDatabaseConnectivityError(new Error(message))).toBe(true);
  }
});
