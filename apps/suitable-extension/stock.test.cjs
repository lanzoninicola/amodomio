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
  "open-here",
  "supplier-name-differs",
  "missing-lines",
  "total-mismatch",
  "total-mismatch-unchecked",
  "existing-batch",
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
      if (["total-mismatch", "total-mismatch-unchecked"].includes(scenario))
        products = products.replace("R$ 71,94", "R$ 70,94");
      if (scenario === "supplier-name-differs")
        products = products.replaceAll("Agrilar Hortifruti", "AGRILAR HORTIFRUTI LTDA");
      const html = `<!doctype html><html><body>${
        scenario === "no-note" ? products : notes
      }<script>
        const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){return original.call(this,{...options,mode:'open'})};
        window.calls=[];window.errors=[];addEventListener('error',e=>errors.push(e.message));
        const view={ok:true,batchId:'batch',existing:${scenario==='existing-batch'},batchStatus:'imported',url:'https://test/admin/import-stock-movements/batch',embedUrl:'https://test/embed/stock-batch/batch?token=t',summary:{total:2,readyToImport:${
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
          if(message.type==='suitable:preferences-read')return {ok:true,kdsEnabled:false,stockCheckTotal:${scenario==='total-mismatch'}};
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
          if('${scenario}'==='ready'){const bar=host.previousElementSibling;if(!bar||!bar.textContent.includes('Fornecedor')||!bar.parentElement.contains(document.querySelector('input[type=text]')))throw new Error('Card is not placed below the supplier bar');window.belowBar=true;}
          if('${scenario}'!=='no-note'){
            if('${scenario}'==='ready'){
              const tab=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Contas');let reached=false;tab.addEventListener('click',()=>{reached=true});
              tab.click();await pause();
              if(reached)throw new Error('Contas tab opened before the batch exists');
              if(!root.querySelector('[role=alert]')?.textContent.includes('Crie o lote de entrada'))throw new Error('Blocked tab gave no message');
              tab.click();await pause();window.blockedTab=true;
            }
            [...root.querySelectorAll('button')].find(b=>b.textContent.includes('Criar lote de entrada')).click();
            for(let i=0;i<30&&!calls.length&&(window.blockedTab||!root.querySelector('[role=alert]'));i++)await pause();
            await pause();
            const link=[...root.querySelectorAll('a')].find(a=>a.textContent.includes('Abrir no Amodomio'));
            window.batchLink=link?.href;window.noIframe=!root.querySelector('iframe')&&!document.querySelector('iframe');
            if('${scenario}'==='open-here'){
              const open=[...root.querySelectorAll('button')].find(b=>b.textContent.includes('Abrir importação aqui'));if(!open)throw new Error('Open-here button missing');
              open.click();await pause();
              const frame=root.querySelector('iframe');if(!frame||frame.src!=='https://test/embed/stock-batch/batch?token=t')throw new Error('Embedded import missing');
              const panel=root.querySelector('#stock-entry-body');if(panel.hidden)throw new Error('Panel hidden');
              const handle=root.querySelector('[data-stock-drag-handle]');const left=parseFloat(panel.style.left);
              handle.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,clientX:left+20,clientY:30,bubbles:true}));
              handle.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:left+80,clientY:30,bubbles:true}));await pause();
              handle.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true}));
              if(!(parseFloat(panel.style.left)>left))throw new Error('Drag failed');
              const grip=root.querySelector('[data-stock-resize="se"]');const before=panel.offsetWidth;
              grip.dispatchEvent(new PointerEvent('pointerdown',{pointerId:3,button:0,clientX:500,clientY:500,bubbles:true}));
              grip.dispatchEvent(new PointerEvent('pointermove',{pointerId:3,clientX:400,clientY:450,bubbles:true}));await pause();
              grip.dispatchEvent(new PointerEvent('pointerup',{pointerId:3,bubbles:true}));
              if(!(panel.offsetWidth<before))throw new Error('Resize failed');
              root.querySelector('[aria-label="Fechar vínculo de produtos"]').click();await pause();
              if(getComputedStyle(panel).display!=='none')throw new Error('Close failed');
              [...root.querySelectorAll('button')].find(b=>b.textContent.includes('Abrir importação aqui')).click();await pause();
              if(panel.hidden||root.querySelector('iframe')!==frame)throw new Error('Reopen reloaded the page');
              window.openVerified=true;
            }
          }
          document.body.dataset.result=JSON.stringify({calls,errors,text:[...root.querySelectorAll(".extension")].map(element=>element.textContent).join(" "),batchLink:window.batchLink,noIframe:window.noIframe,openVerified:window.openVerified,belowBar:window.belowBar,blockedTab:window.blockedTab,tabAfter:(()=>{const t=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Contas');let r=false;if(t){t.addEventListener('click',()=>{r=true});t.click();}return r})()});
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
          "open-here",
          "supplier-name-differs",
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
      if (["ready", "paged", "virtual", "pending", "open-here", "supplier-name-differs", "total-mismatch-unchecked", "existing-batch"].includes(scenario)) {
        assert.deepEqual(
          result.calls.map((c) => c.action),
          ["create"]
        );
        assert.equal(
          result.batchLink,
          "https://test/admin/import-stock-movements/batch"
        );
        if (scenario === "ready") {
          assert.equal(result.belowBar, true);
          assert.equal(result.blockedTab, true);
          assert.equal(result.tabAfter, true);
        }
        if (scenario === "open-here") assert.equal(result.openVerified, true);
        else assert.equal(result.noIframe, true);
        if (scenario === "existing-batch")
          assert.match(
            result.text,
            /Lote já existia no Amodomio \(já importado\)/
          );
        else assert.match(result.text, /Lote criado/);
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
