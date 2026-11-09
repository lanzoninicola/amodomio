const { test } = require("node:test");
const assert = require("node:assert/strict");

test("som de aguardando forno ignora primeira carga e repeticoes, detecta entrada e retorno", async () => {
  const { newlyAwaitingOven } = await import(
    "../mobile/src/kds/awaiting-oven.ts"
  );
  const waiting = { id: "1", status: "aguardandoForno" };
  assert.deepEqual(newlyAwaitingOven([waiting], null), []);
  const previous = new Map([["1", "novoPedido"]]);
  assert.deepEqual(newlyAwaitingOven([waiting], previous), [waiting]);
  previous.set("1", "aguardandoForno");
  assert.deepEqual(newlyAwaitingOven([waiting], previous), []);
  assert.deepEqual(newlyAwaitingOven([{ ...waiting, id: "2" }], previous), [
    { ...waiting, id: "2" },
  ]);
  assert.deepEqual(
    newlyAwaitingOven([{ ...waiting, status: "assando" }], previous),
    []
  );
  previous.set("1", "assando");
  assert.deepEqual(newlyAwaitingOven([waiting], previous), [waiting]);
});
