const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { spawnSync } = require("node:child_process");
for (const scenario of [
  "ready",
  "paged",
  "virtual",
  "pending",
  "collapse",
  "floating",
  "missing-lines",
  "total-mismatch",
  "no-note",
]) {
  test(`stock invoice Chrome DOM: ${scenario}`, () => {
    const directory = mkdtempSync(join(tmpdir(), "suitable-stock-"));
    try {
      const notes = readFileSync(
        join(__dirname, "fixtures/suitable-invoices.html"),
        "utf8"
      );
      let products = readFileSync(
        join(__dirname, "fixtures/suitable-products.html"),
        "utf8"
      );
      if (scenario === "missing-lines")
        products = products.replace(
          "Mostrando 2 resultados de 2 resultados",
          "Mostrando 3 resultados de 3 resultados"
        );
      if (scenario === "total-mismatch")
        products = products.replace("R$ 71,94", "R$ 70,94");
      const html = `<!doctype html><html><body>${
        scenario === "no-note" ? products : notes
      }<script>
        const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){return original.call(this,{...options,mode:'open'})};
        window.calls=[];window.errors=[];addEventListener('error',e=>errors.push(e.message));
        const view={ok:true,batchId:'batch',url:'https://test/admin/import-stock-movements/batch',embedUrl:'https://test/embed/stock-batch/batch?token=t',summary:{total:2,readyToImport:${
          scenario === "pending"
            ? 0
            : ["collapse", "floating"].includes(scenario)
            ? 1
            : 2
        },imported:0,skippedDuplicate:0},
          lines:[{id:'a',ingredientName:'Abobrinha Verde Kg',qtyEntry:3.38,unitEntry:'KG',costAmount:5.95,costTotalAmount:20.08,status:'${
            scenario === "pending" ? "pending_mapping" : "ready"
          }',mappedItemId:'${
        scenario === "pending" ? "" : "item"
      }'},{id:'b',ingredientName:'Cogumelo Paris Uni',qtyEntry:6,unitEntry:'AGR',costAmount:11.99,costTotalAmount:71.94,status:'${
        ["collapse", "floating"].includes(scenario)
          ? "pending_conversion"
          : "ready"
      }',targetUnit:'KG',mappedItemId:'item'}],items:[{id:'item',name:'Abobrinha',unit:'KG'},{id:'mushrooms',name:'Cogumelos',unit:'KG'}]};
        window.chrome={runtime:{onMessage:{addListener(){}},async sendMessage(message){
          if(message.type==='suitable:preferences-read')return {ok:true,kdsEnabled:false};
          calls.push(message.payload);
          if(message.payload.action==='map'){view.lines.find(line=>line.id===message.payload.lineId).mappedItemId=message.payload.itemId;}
          if(message.payload.action==='step'){view.summary.readyToImport=0;view.summary.imported=2;view.lines.forEach(line=>line.status='imported');return {ok:true,done:true,progress:{processedCount:2,totalCount:2,errorCount:0}};}
          return structuredClone(view);
        }}};
        </script><script>${readFileSync(
          join(__dirname, "parser.js"),
          "utf8"
        )}</script><script>${readFileSync(
        join(__dirname, "content.js"),
        "utf8"
      )}</script><script>
        (async()=>{
          const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
          if('${scenario}'!=='no-note'){
            [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Lançar entrada').click();
            document.querySelector('[role=presentation]').outerHTML=${JSON.stringify(
              products
            )};
          }
          if(['paged','virtual'].includes('${scenario}')) {
            const dialog=document.querySelector('[role=dialog]');
            const rows=[...dialog.querySelectorAll('[data-index]')];
            const second=rows[1].cloneNode(true);rows[1].remove();
            if('${scenario}'==='paged') {
              [...dialog.querySelectorAll('p')].find(p=>p.textContent.startsWith('Mostrando')).textContent='Mostrando 1 resultados de 2 resultados';
              const next=dialog.querySelector('button[aria-label="Go to next page"]');next.disabled=false;
              next.onclick=()=>{second.dataset.index='0';dialog.querySelector('[data-index]').replaceWith(second);next.disabled=true;};
            } else {
              const scroller=document.createElement('div');scroller.style.cssText='height:60px;overflow-y:auto';
              const content=rows[0].parentElement;content.before(scroller);scroller.append(content);content.style.height='300px';
              scroller.addEventListener('scroll',()=>{if(scroller.scrollTop>0 && dialog.querySelector('[data-index="0"]')) dialog.querySelector('[data-index="0"]').replaceWith(second);});
              const property=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
              Object.defineProperty(scroller,'scrollTop',{get(){return property.get.call(this)},set(value){property.set.call(this,value);this.dispatchEvent(new Event('scroll'));}});
            }
          }
          for(let i=0;i<20&&!document.querySelector('[data-amodomio-stock]');i++)await pause();
          const host=document.querySelector('[data-amodomio-stock]');if(!host)throw new Error('Stock panel missing');
          const root=host.shadowRoot;
          if('${scenario}'!=='no-note'){
            [...root.querySelectorAll('button')].find(b=>b.textContent.includes('Criar / recuperar')).click();
            for(let i=0;i<30&&!calls.length&&!root.querySelector('[role=alert]');i++)await pause();
            await pause();
            if('${scenario}'==='collapse') {
              const frame=root.querySelector('iframe');if(!frame||frame.src!=='https://test/embed/stock-batch/batch?token=t')throw new Error('Embedded import missing');
              [...root.querySelectorAll('button')].find(b=>b.textContent.includes('Ver tabela do Suitable')).click();await pause();
              if(!root.querySelector('#stock-entry-body').hidden)throw new Error('Review did not collapse');
              if(getComputedStyle(root.querySelector('#stock-entry-body')).display!=='none')throw new Error('Review still takes space');
              if(!document.querySelector('[role=dialog] [data-index]').textContent.includes('Abobrinha'))throw new Error('Suitable rows missing');
              const nativeRow=document.querySelector('[role=dialog] [data-index]');
              if(nativeRow.closest('[hidden]'))throw new Error('Native table was hidden');
              [...root.querySelectorAll('button')].find(b=>b.textContent.includes('Abrir vínculo de produtos')).click();await pause();
              if(root.querySelector('#stock-entry-body').hidden)throw new Error('Review did not reopen');
              if(root.querySelector('iframe')!==frame)throw new Error('Embedded page reloaded');
              if(calls.length!==1)throw new Error('Collapse must not create, update or import a lot');
              window.collapseVerified=true;
            }
            if('${scenario}'==='floating') {
              const panel=root.querySelector('#stock-entry-body');const handle=root.querySelector('[data-stock-drag-handle]');
              if(!panel||panel.getAttribute('aria-modal')!=='false'||getComputedStyle(panel).position!=='fixed')throw new Error('Floating dialog missing');
              const initialLeft=parseFloat(panel.style.left);
              const frame=root.querySelector('iframe');if(!frame)throw new Error('Embedded import missing');
              handle.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,clientX:initialLeft+20,clientY:30,bubbles:true}));
              handle.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:initialLeft+60,clientY:30,bubbles:true}));await pause();
              handle.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true}));
              if(parseFloat(panel.style.left)<=initialLeft)throw new Error('Pointer drag did not move dialog');
              const movedLeft=panel.style.left;
              root.querySelector('[aria-label="Fechar vínculo de produtos"]').click();await pause();
              if(getComputedStyle(panel).display!=='none')throw new Error('Close did not hide floating dialog');
              [...root.querySelectorAll('button')].find(b=>b.textContent.includes('Abrir vínculo de produtos')).click();await pause();
              if(panel.hidden||root.querySelector('iframe')!==frame||panel.style.left!==movedLeft)throw new Error('Reopening lost draft or position');
              handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await pause();
              if(parseFloat(panel.style.left)>=parseFloat(movedLeft))throw new Error('Keyboard movement failed');
              handle.dispatchEvent(new PointerEvent('pointerdown',{pointerId:2,button:0,clientX:20,clientY:30,bubbles:true}));
              handle.dispatchEvent(new PointerEvent('pointermove',{pointerId:2,clientX:-10000,clientY:-10000,bubbles:true}));await pause();
              handle.dispatchEvent(new PointerEvent('pointerup',{pointerId:2,bubbles:true}));
              if(parseFloat(panel.style.left)<8||parseFloat(panel.style.top)<8)throw new Error('Dialog moved outside screen');
              const grip=root.querySelector('[data-stock-resize="se"]');if(!grip)throw new Error('Resize handle missing');
              const before=panel.offsetWidth;
              grip.dispatchEvent(new PointerEvent('pointerdown',{pointerId:3,button:0,clientX:500,clientY:500,bubbles:true}));
              grip.dispatchEvent(new PointerEvent('pointermove',{pointerId:3,clientX:400,clientY:450,bubbles:true}));await pause();
              grip.dispatchEvent(new PointerEvent('pointerup',{pointerId:3,bubbles:true}));
              if(!(panel.offsetWidth<before))throw new Error('Resize did not shrink dialog');
              window.floatingVerified=true;
            }
          }
          document.body.dataset.result=JSON.stringify({calls,errors,text:[...root.querySelectorAll(".extension")].map(element=>element.textContent).join(" "),collapseVerified:window.collapseVerified,floatingVerified:window.floatingVerified});
        })().catch(error=>document.body.dataset.result=JSON.stringify({error:error.stack,calls,errors}));
        </script></body></html>`;
      const file = join(directory, "test.html");
      writeFileSync(file, html);
      const chrome = spawnSync(
        process.env.CHROME_BIN || "/usr/bin/google-chrome",
        [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--window-size=1600,1000",
          `--user-data-dir=${join(directory, "profile")}`,
          "--virtual-time-budget=8000",
          "--dump-dom",
          `file://${file}`,
        ],
        { encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024 }
      );
      assert.equal(chrome.status, 0, chrome.stderr);
      const match = chrome.stdout.match(/data-result="([^"]*)"/);
      assert.ok(match, "Browser result missing");
      const result = JSON.parse(
        match[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
      );
      assert.equal(result.error, undefined, JSON.stringify(result));
      assert.deepEqual(result.errors, []);
      if (
        [
          "ready",
          "pending",
          "paged",
          "virtual",
          "collapse",
          "floating",
        ].includes(scenario)
      ) {
        assert.equal(result.calls[0].note.invoiceNumber, "000002377");
        assert.equal(result.calls[0].note.supplierName, "Agrilar Hortifruti");
        assert.equal(result.calls[0].note.date, "2026-10-08");
        assert.deepEqual(
          result.calls[0].note.lines.map((l) => [
            l.qtyEntry,
            l.unitEntry,
            l.costTotalAmount,
          ]),
          [
            [3.38, "KG", 20.08],
            [6, "AGR", 71.94],
          ]
        );
      }
      if (["ready", "paged", "virtual", "pending"].includes(scenario)) {
        assert.deepEqual(
          result.calls.map((c) => c.action),
          ["create"]
        );
      }
      if (scenario === "floating") {
        assert.equal(result.floatingVerified, true);
        assert.deepEqual(
          result.calls.map((c) => c.action),
          ["create"]
        );
      }
      if (scenario === "collapse") {
        assert.equal(result.collapseVerified, true);
        assert.equal(result.calls.length, 1);
      }
      if (scenario === "missing-lines") {
        assert.equal(result.calls.length, 0);
        assert.match(result.text, /todos os produtos/);
      }
      if (scenario === "total-mismatch") {
        assert.equal(result.calls.length, 0);
        assert.match(result.text, /soma dos produtos/);
      }
      if (scenario === "no-note") {
        assert.equal(result.calls.length, 0);
        assert.match(result.text, /Volte à lista/);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
