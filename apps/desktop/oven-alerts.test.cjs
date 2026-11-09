const { test } = require('node:test');
const assert = require('node:assert/strict');
test('aviso de forno: pendentes, reconhecimento, cancelamento e nova solicitação', async () => {
  const { pendingOvenAlerts } = await import('../mobile/src/kds/oven-alerts.ts');
  const seen = new Map();
  const order = { id: '1', status: 'aguardandoForno', requestedForOven: true };
  assert.equal(pendingOvenAlerts([order], seen).length, 1);
  seen.set('1', Infinity);
  assert.equal(pendingOvenAlerts([order], seen).length, 0);
  assert.equal(pendingOvenAlerts([{ ...order, requestedForOven: false }], seen).length, 0);
  assert.equal(pendingOvenAlerts([order], seen).length, 1);
  assert.equal(pendingOvenAlerts([{ ...order, status: 'assando' }], seen).length, 0);
  assert.equal(pendingOvenAlerts([order, { ...order, id: '2' }], seen).length, 2);
});

test('Entendi pausa cada pedido por 15 segundos e permite novos lembretes', async () => {
  const { pendingOvenAlerts, OVEN_ALERT_REMINDER_MS } = await import('../mobile/src/kds/oven-alerts.ts');
  const order = { id: '1', status: 'aguardandoForno', requestedForOven: true };
  const other = { ...order, id: '2' };
  const seen = new Map([['1', 1000 + OVEN_ALERT_REMINDER_MS], ['2', 2000 + OVEN_ALERT_REMINDER_MS]]);
  assert.deepEqual(pendingOvenAlerts([order, other], seen, 15999), []);
  assert.deepEqual(pendingOvenAlerts([order, other], seen, 16000), [order]);
  seen.set('1', 16000 + OVEN_ALERT_REMINDER_MS);
  assert.deepEqual(pendingOvenAlerts([order, other], seen, 17000), [other]);
  assert.deepEqual(pendingOvenAlerts([order], seen, 31000), [order]);
});

test('Assando ou cancelamento antes do prazo encerram o lembrete', async () => {
  const { pendingOvenAlerts } = await import('../mobile/src/kds/oven-alerts.ts');
  for (const change of [{ status: 'assando' }, { requestedForOven: false }]) {
    const seen = new Map([['1', 15000]]);
    const order = { id: '1', status: 'aguardandoForno', requestedForOven: true, ...change };
    assert.deepEqual(pendingOvenAlerts([order], seen, 15000), []);
    assert.equal(seen.size, 0);
  }
});
