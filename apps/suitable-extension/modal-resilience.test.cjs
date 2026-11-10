const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

test('KDS survives missing summary, changed heading, and replaced header', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kds-resilience-'));
  try {
    const parser = readFileSync(join(__dirname, 'parser.js'), 'utf8');
    const content = readFileSync(join(__dirname, 'content.js'), 'utf8');
    const file = join(directory, 'test.html');
    writeFileSync(file, `<!doctype html><body>
      <div role="dialog"><header><div><h2>Detalhes do pedido ordem 24</h2></div><button>Ações</button></header></div>
      <script>
      window.addEventListener('error', event=>document.body.dataset.result=event.message);
      window.chrome={runtime:{sendMessage:async message=>message.type==='suitable:preferences-read'?{ok:true,kdsEnabled:true,stockEnabled:false}:{ok:true,statuses:[]}}};
      const original=Element.prototype.attachShadow;
      Element.prototype.attachShadow=function(options){return original.call(this,{...options,mode:'open'})};
      ${parser}
      ${content}
      (async()=>{try{
        const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
        await wait();
        const dialog=document.querySelector('[role=dialog]');
        let host=dialog.querySelector('[data-amodomio-kds]');
        if(!host || host.parentElement!==dialog) throw Error('KDS must mount outside provider actions without requiring a summary');
        const button=host.shadowRoot.querySelector('button');
        if(button.disabled || !host.shadowRoot.querySelector('[role=alert]')) throw Error('Missing data must show actionable feedback');
        button.click(); await wait();
        if(dialog.querySelector('[data-amodomio-review]')) throw Error('Incomplete data must not open review');
        dialog.querySelector('header').replaceWith(dialog.querySelector('header').cloneNode(true));
        await wait();
        if(dialog.querySelectorAll('[data-amodomio-kds]').length!==1) throw Error('Header replacement must preserve one action');
        host.remove(); await wait();
        host=dialog.querySelector('[data-amodomio-kds]');
        if(!host) throw Error('Removed action must be restored');
        document.body.dataset.result='ok';
      }catch(error){document.body.dataset.result=error.stack}})();
      </script>`);
    const chrome = spawnSync(process.env.CHROME_BIN || '/usr/bin/google-chrome', [
      '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      `--user-data-dir=${join(directory, 'profile')}`, '--dump-dom',
      '--virtual-time-budget=5000', `file:///${file.replaceAll('\\', '/')}`,
    ], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(chrome.status, 0, chrome.error?.message || chrome.stderr);
    assert.equal(chrome.stdout.match(/<body[^>]*data-result="([^"]*)"/)?.[1], 'ok', chrome.stdout.slice(0, 800));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
