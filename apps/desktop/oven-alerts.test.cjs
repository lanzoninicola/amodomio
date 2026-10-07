const { test } = require('node:test');
const assert = require('node:assert/strict');
test('aviso de forno: pendentes, reconhecimento, cancelamento e nova solicitação', async () => {
  const { pendingOvenAlerts } = await import('../mobile/src/kds/oven-alerts.ts');
  const seen = new Set();
  const order = { id: '1', status: 'aguardandoForno', requestedForOven: true };
  assert.equal(pendingOvenAlerts([order], seen).length, 1);
  seen.add('1');
  assert.equal(pendingOvenAlerts([order], seen).length, 0);
  assert.equal(pendingOvenAlerts([{ ...order, requestedForOven: false }], seen).length, 0);
  assert.equal(pendingOvenAlerts([order], seen).length, 1);
  assert.equal(pendingOvenAlerts([{ ...order, status: 'assando' }], seen).length, 0);
  assert.equal(pendingOvenAlerts([order, { ...order, id: '2' }], seen).length, 2);
});
