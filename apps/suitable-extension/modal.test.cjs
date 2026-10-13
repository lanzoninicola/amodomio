const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

for (const [width, delivery, blocked] of [
  [820, false],
  [360, false],
  [820, true],
  [360, true],
  [820, false, "exists"],
  [360, true, "shortage"],
  [820, false, "missing-day"],
  [360, false, "open-error"],
]) {
  test(`Chrome DOM ${delivery ? "delivery" : "pickup"} at ${width}px ${
    blocked || ""
  }: React review, isolated CSS, sizes, fixed footer and send`, () => {
    const directory = mkdtempSync(join(tmpdir(), "suitable-modal-test-"));
    try {
      const fixture = readFileSync(
        join(
          __dirname,
          delivery
            ? "fixtures/suitable-delivery-modal.html"
            : "fixtures/suitable-order-modal.html"
        ),
        "utf8"
      );
      const parser = readFileSync(join(__dirname, "parser.js"), "utf8");
      const content = readFileSync(join(__dirname, "content.js"), "utf8");
      const html = `<!doctype html><html><head><style>
      html {font-size:40px} body {font:70px serif;color:magenta;line-height:7}
      button,input,textarea {font-size:75px!important;background:magenta!important;width:10px!important;border:25px solid red!important}
      [role=dialog] {width:${width}px;font-family:serif;color:magenta}
      .MuiDialog-paper {display:flex;flex-direction:column;max-height:calc(100vh - 64px);overflow-y:auto}
      .MuiDialog-paper > div {flex-shrink:0}
    </style></head><body><div id="kanban"><h6>#1</h6><span title="Nicola Lanzoni"><h6>Nicola Lanzoni</h6></span></div>${fixture}<script>
      window.jsErrors=[];window.addEventListener("error",event=>window.jsErrors.push(event.message));const originalAttach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function(options) { return originalAttach.call(this, {...options, mode: 'open'}); };
      window.dayOpened=false;window.openCalls=0;window.checkCalls=0;
      window.chrome = { runtime: { async sendMessage(message) { if(message.type==='suitable:customer') return {ok:true,purchaseSummary:{last:'2026-10-10T00:00:00-03:00',weekly:1.5,monthly:6}}; if(message.type==='suitable:open-day'){ window.openCalls++; await new Promise(resolve=>setTimeout(resolve,60)); if(${
        blocked === "open-error"
      }) return {ok:false,error:'Falha ao abrir dia'}; window.dayOpened=true; return {ok:true,dayStatus:'OPENED'}; } if(message.type==='suitable:check') {window.checkCalls++; return {ok:true,check:{exists:${
        blocked === "exists"
      },status:${
        blocked === "exists" ? "'finalizado'" : "null"
      },available:{F:20,M:20,P:20,I:${
        blocked === "shortage" ? 0 : 20
      },FT:20},shortages:${blocked === "shortage" ? "['I']" : "[]"},dayStatus:${
        ["missing-day", "open-error"].includes(blocked)
          ? "window.dayOpened?'OPENED':'MISSING'"
          : "'OPENED'"
      },canSend:${
        ["missing-day", "open-error"].includes(blocked)
          ? "window.dayOpened"
          : blocked !== "shortage"
      }}};} if(message.type==='suitable:zones') return {ok:true,zones:[{id:'morro-id',name:'Morro da Cruz',city:'Pato Branco'},{id:'centro-id',name:'Centro',city:'Pato Branco'}]}; window.sent = message; return {ok:true, id:'imported', status:'novoPedido'}; } } };
      ${parser}
      ${content}
      (async () => {
        try {
          const dialog = document.querySelector('[role=dialog]');
          const headerButton = dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button');
          for(let attempt=0;attempt<30 && headerButton.disabled;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
          if(window.checkCalls!==1) throw new Error('Opening order details must query KDS once before clicking');
          if(headerButton.textContent.includes('Comanda enviada')!==${
            blocked === "exists"
          }) throw new Error('Header must reflect the existing KDS command before clicking');
          const extracted = SuitableKds.extractModal(dialog);
          const cardButtons = document.querySelector('#kanban').querySelectorAll('[data-amodomio-kds]').length;
          const buttonCount = dialog.querySelectorAll('[data-amodomio-kds]').length;
          const summaryHeading = [...dialog.querySelectorAll('h6')].find(element=>element.textContent.trim()==='Resumo de valores');
          summaryHeading.textContent='Carregando valores…';
          dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button').click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(!dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('[role=alert]')?.textContent.includes('Não foi possível ler o pedido')) throw new Error('Unreadable orders must show an error instead of silently ignoring the click');
          if(dialog.querySelector('[data-amodomio-review]')) throw new Error('Unreadable orders must not open or send an incomplete review');
          summaryHeading.textContent='Resumo de valores';
          dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button').click();
          const review = dialog.querySelector('[data-amodomio-review]').shadowRoot;
          const form = review.querySelector('form');
          const refresh=review.querySelector('[aria-label="Atualizar comanda e estoque"]');
          const detail=review.querySelector('[aria-controls=order-details]');
          if(!refresh || refresh.textContent.trim() || detail.textContent.trim()) throw new Error('Refresh and details must be icon only');
          if(refresh.nextElementSibling!==detail) throw new Error('Refresh must precede details');
          const kdsRow=review.querySelector('.kds-review-row');
          if(!kdsRow || kdsRow.querySelector('.command-bubble')?.textContent.trim()!=='Revisar pedido · 1') throw new Error('Header must start with the KDS command bubble');
          if(!kdsRow.querySelector('.order-total') || !kdsRow.querySelector('[aria-label="Resumo de tamanhos"]')) throw new Error('KDS row must show amount and sizes');
          const neighborhood=review.querySelector('.delivery-neighborhood');
          if(${delivery}) for(let attempt=0;attempt<30 && !neighborhood?.textContent.includes('Morro da Cruz');attempt++) await new Promise(resolve=>setTimeout(resolve,10));
          if(${delivery} ? !neighborhood?.textContent.includes('Morro da Cruz') : !!neighborhood) throw new Error('Header must show the neighborhood only for delivery');
          const channelTrigger=review.querySelector('[aria-labelledby=channel-label]');
          if(!channelTrigger?.textContent.includes('CARDAPIO')) throw new Error('Origin must default to CARDAPIO');
          if(!getComputedStyle(review.querySelector('.order-total')).fontFamily.includes('monospace')) throw new Error('Order total must use mono');
          if(getComputedStyle(review.querySelector('.customer-name')).fontSize !== getComputedStyle(review.querySelector('.customer-phone')).fontSize) throw new Error('Customer styles should match');
          if(!review.querySelector('.scroll').hidden || detail.getAttribute('aria-expanded') !== 'false') throw new Error('Clicking Add to KDS must start with details collapsed');
          if(review.querySelector('.heading').getBoundingClientRect().height < 30 || review.querySelector('.footer').getBoundingClientRect().height < 30) throw new Error('Summary and actions must remain visible with details collapsed');
          detail.click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(review.querySelector('.scroll').hidden || review.querySelector('.scroll').getBoundingClientRect().height < 30) throw new Error('Details toggle must open the form inside the flex dialog');
          detail.click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(!review.querySelector('.scroll').hidden) throw new Error('Details toggle must collapse the form');
          if(!review.querySelector('header [name=customerName]') || !review.querySelector('header [name=customerPhone]')) throw new Error('Customer must be in header');
          if(review.querySelector('header').textContent.includes('Revisão') || review.querySelector('header').textContent.includes('Suitable → KDS')) throw new Error('Removed header labels returned');
          const customer=review.querySelector('[name=customerName]');
          if(!customer.readOnly) throw new Error('Customer should look like text initially');
          customer.focus();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(customer.readOnly) throw new Error('Click/focus must enable customer editing');
          customer.blur();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(!customer.readOnly) throw new Error('Blur must finish customer editing');
          await document.fonts.ready;
          if(!document.fonts.check('14px SuitableInter') || ![...document.fonts].some(face=>face.family==='SuitableInter' && face.status==='loaded')) throw new Error('Local Inter font did not load');
          channelTrigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
          await new Promise(resolve=>setTimeout(resolve,30));
          if([...review.querySelectorAll('[role=option]')].some(option=>option.textContent==='Suitable')) throw new Error('Suitable must not be offered as a sales channel');
          const channelOption=[...review.querySelectorAll('[role=option]')].find(option=>option.textContent==='AIQFOME');
          if(!channelOption || document.querySelector('[role=listbox]')) throw new Error('Origin options must stay inside the Shadow DOM');
          channelOption.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
          await new Promise(resolve=>setTimeout(resolve,30));
          if(!channelTrigger.textContent.includes('AIQFOME')) throw new Error('Changing the order origin must update the select');
          if (${delivery}) {
            const trigger=review.querySelector('header [aria-labelledby=delivery-label]');
            if(!trigger || !review.querySelector('.scroll').hidden) throw new Error('Delivery neighborhood must be editable with details collapsed');
            for(let attempt=0;attempt<30 && trigger.disabled;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
            trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
            await new Promise(resolve=>setTimeout(resolve,30));
            const option=[...review.querySelectorAll('[role=option]')].find(element=>element.textContent.includes('Centro'));
            if(!option) throw new Error('Other registered neighborhoods must be available');
            option.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
            await new Promise(resolve=>setTimeout(resolve,30));
            if(!trigger.textContent.includes('Centro') || !review.querySelector('.scroll').hidden) throw new Error('Neighborhood changes must update the header without opening details');
          }
          if(review.querySelector('button[type=submit]').textContent!=='Enviar') throw new Error('Submit button must say Enviar');
          review.querySelector('[aria-controls=order-details]').click();
          await new Promise(resolve=>setTimeout(resolve,20));
            if (${["missing-day", "open-error"].includes(blocked)}) {
              for(let attempt=0;attempt<60 && review.querySelector('.order-checks').getAttribute('aria-busy')==='true';attempt++) await new Promise(resolve=>setTimeout(resolve,10));
              const column=[...review.querySelectorAll('.check-column')].find(element=>element.querySelector('h3').textContent==='Abertura dia');
              if(column.dataset.state!=='error') throw new Error('Missing day must show X');
              const opening=column.querySelector('button');
              if(!opening || opening.textContent!=='Abrir o dia') throw new Error('Missing day must offer Abrir dia next to X');
              opening.click();
              await new Promise(resolve=>setTimeout(resolve,10));
              if(column.dataset.state!=='loading' || !opening.disabled || !review.querySelector('button[type=submit]').disabled) throw new Error('Opening must wait with loading icon and disabled actions');
              for(let attempt=0;attempt<80 && !review.querySelector('header').textContent.includes('Falha ao abrir dia') && (column.dataset.state!=='ok');attempt++) await new Promise(resolve=>setTimeout(resolve,10));
              if(${blocked === "open-error"}) {
                if(column.dataset.state!=='error' || !review.querySelector('header').textContent.includes('Falha ao abrir dia')) throw new Error('Opening failure must retain X and show the server error');
                if(window.sent || window.openCalls!==1) throw new Error('Opening failure must not create an order');
                document.body.dataset.result=JSON.stringify({openingFailed:true});return;
              }
              if(column.dataset.state!=='ok' || column.querySelector('button') || !getComputedStyle(column.querySelector('.check-icon')).animationName.includes('check-success')) throw new Error('Confirmed opening must change to animated check and remove the action');
              if(window.openCalls!==1) throw new Error('Opening must not duplicate requests');
            }
            if (${blocked === "shortage"}) {
              await new Promise(resolve=>setTimeout(resolve,450));
              if(${
                blocked === "exists"
              } && !dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button').textContent.includes('Comanda enviada')) throw new Error('Existing command must update the header to Comanda enviada');
              form.requestSubmit();
              await new Promise(resolve=>setTimeout(resolve,20));
              document.body.dataset.result=JSON.stringify({blocked:true,errorColor:getComputedStyle(review.querySelectorAll('.check-column')[${
                blocked === "exists" ? 0 : 1
              }]).color,disabled:review.querySelector('button[type=submit]').disabled,sent:!!window.sent,text:review.querySelector('header').textContent,stock:[...review.querySelectorAll('.dough-number')].map(el=>({size:el.querySelector('span').textContent,value:el.querySelector('strong').textContent,shortage:el.dataset.shortage}))});
              return;
            }
            let isolatedPortal = null;
            if (${delivery}) {
              for(let attempt=0;attempt<30 && !review.querySelector('[aria-labelledby=delivery-label]').textContent.includes('Centro');attempt++) await new Promise(resolve=>setTimeout(resolve,10));
              const trigger=review.querySelector('[aria-labelledby=delivery-label]');
              trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
              await new Promise(resolve=>setTimeout(resolve,30));
              isolatedPortal = !!review.querySelector('[role=listbox]') && !document.querySelector('[role=listbox]');
              trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
              await new Promise(resolve=>setTimeout(resolve,20));
            }
            const noProductField = !review.querySelector('.name');
          const scroll = review.querySelector('.scroll');
          const footer = review.querySelector('.footer');
          const footerBefore = footer.getBoundingClientRect().top;
          scroll.scrollTop = scroll.scrollHeight;
          const layout = {
            inputFont: getComputedStyle(form.querySelector('input')).fontSize,
            inputBackground: getComputedStyle(form.querySelector('input')).backgroundColor,
            panelWidth: form.getBoundingClientRect().width,
            overflow: form.scrollWidth > form.clientWidth + 1,
            footerFixed: Math.abs(footer.getBoundingClientRect().top - footerBefore) < 1,
            footerVisible: footer.getBoundingClientRect().bottom <= form.getBoundingClientRect().bottom + 1, footerRect: footer.getBoundingClientRect().toJSON(), formRect: form.getBoundingClientRect().toJSON(),
            footerButtonVisible: form.querySelector('[type=submit]').getBoundingClientRect().right <= form.getBoundingClientRect().right,
            collapsedNotes: !review.querySelector('details').open,
            total: form.querySelector('[name=orderAmount]').value,
          };
          const invalid = [...form.elements].filter(element=>element.validity && !element.validity.valid).map(element=>({name:element.name,validation:element.validationMessage,value:element.value}));
          for(let attempt=0;attempt<60 && review.querySelector('button[type=submit]').disabled;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
          form.requestSubmit();
          for (let attempt = 0; attempt < 30 && !review.querySelector('[type=submit]')?.hidden && review.querySelector('[type=submit]'); attempt++) {
            if (review.querySelector('.message').textContent.includes('Pedido enviado')) break;
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          const success = review.querySelector('.message').textContent;
          if(!dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button').textContent.includes('Comanda enviada')) throw new Error('Successful send must update the header button');
          // Read again after the extension inserts its own form: capture must stay unchanged.
          const reread = SuitableKds.extractModal(dialog);
          // A recycled/updated order must be read on the next click.
          dialog.querySelector('h6').textContent = 'Detalhes do pedido ordem 2';
          dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button').click();
          const changedReview = dialog.querySelector('[data-amodomio-review]').shadowRoot;
          const changedNumber = changedReview.querySelector('[name=commandNumber]').value;
          changedReview.querySelector('[aria-label="Tamanho do item 1"] button').click();
          await new Promise(resolve => setTimeout(resolve, 20));
          const changedSize = changedReview.querySelector('[aria-label="Tamanho do item 1"] [aria-pressed=true]').textContent;
          const summary = changedReview.querySelector('[aria-label="Resumo de tamanhos"]').textContent;
          document.body.dataset.result = JSON.stringify({extracted,cardButtons,buttonCount,sent:window.sent,success,reread,changedNumber,layout,changedSize,summary,isolatedPortal,noProductField,invalid});
        } catch (error) { document.body.dataset.result = JSON.stringify({error:error.stack, jsErrors:window.jsErrors, extracted:SuitableKds.extractModal(document.querySelector('[role=dialog]')),buttonCount:document.querySelectorAll('[data-amodomio-kds]').length}); }
      })();
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
          "--no-first-run",
          `--user-data-dir=${join(directory, "profile")}`,
          "--virtual-time-budget=1000",
          "--dump-dom",
          `file://${file}`,
        ],
        { encoding: "utf8", timeout: 30000, maxBuffer: 5 * 1024 * 1024 }
      );
      assert.equal(chrome.status, 0, chrome.stderr);
      const resultMatch = chrome.stdout.match(/data-result="([^"]*)"/);
      assert.ok(resultMatch, "Browser result missing");
      const result = JSON.parse(
        resultMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
      );
      assert.equal(result.error, undefined, JSON.stringify(result));
      if (blocked === "open-error") {
        assert.equal(result.openingFailed, true);
        return;
      }
      if (blocked === "shortage") {
        assert.equal(result.disabled, true);
        assert.equal(
          result.errorColor,
          blocked === "exists" ? "rgb(21, 128, 61)" : "rgb(185, 28, 28)"
        );
        assert.equal(result.sent, false);
        assert.match(
          result.text,
          blocked === "exists" ? /já existe no servidor/ : /Massa insuficiente/
        );
        if (blocked === "shortage") {
          assert.deepEqual(
            result.stock.find((row) => row.size === "I"),
            { size: "I", value: "0", shortage: "true" }
          );
          assert.deepEqual(
            result.stock.find((row) => row.size === "P"),
            { size: "P", value: "20", shortage: "false" }
          );
        }
        return;
      }
      assert.equal(result.layout.inputFont, "14px");
      assert.notEqual(result.layout.inputBackground, "rgb(255, 0, 255)");
      assert.equal(result.layout.overflow, false);
      assert.equal(result.layout.footerFixed, true);
      assert.equal(
        result.layout.footerVisible,
        true,
        JSON.stringify(result.layout)
      );
      assert.equal(result.layout.footerButtonVisible, true);
      assert.equal(result.layout.collapsedNotes, true);
      assert.equal(result.layout.total, delivery ? "479,60" : "359,70");
      assert.equal(result.noProductField, true);
      assert.equal(result.sent.order.channel, "AIQFOME");
      if (delivery) assert.equal(result.isolatedPortal, true);
      assert.equal(result.changedSize, "F");
      assert.match(result.summary, /F2/);
      assert.equal(result.cardButtons, 0);
      assert.equal(result.buttonCount, 1);
      assert.equal(result.extracted.commandNumber, 1);
      assert.equal(result.extracted.date, "2026-10-11");
      assert.equal(result.extracted.customerName, "Nicola Lanzoni");
      assert.equal(result.extracted.customerPhone, "46991052049");
      assert.equal(result.extracted.orderAmount, delivery ? 479.6 : 359.7);
      assert.equal(result.extracted.takeAway, !delivery);
      assert.equal(result.extracted.deliveryFee, delivery ? 10 : 0);
      assert.equal(
        result.extracted.deliveryNeighborhood,
        delivery ? "Morro da Cruz" : ""
      );
      assert.deepEqual(
        result.extracted.orderItems.map((item) => [item.quantity, item.size]),
        [
          [1, "I"],
          [delivery ? 2 : 1, "M"],
          [1, "F"],
        ]
      );
      assert.deepEqual(result.extracted.orderItems[2].flavors, [
        "1x Boscaiola",
        "1x Calabresa",
        "1x Calabresa Acebolada",
      ]);
      assert.equal(result.extracted.orderItems[0].flavors[0], "1x A more mio");
      assert.ok(result.sent, JSON.stringify(result));
      assert.deepEqual(
        result.sent.order,
        delivery
          ? {
              ...result.extracted,
              channel: "AIQFOME",
              updateExisting: blocked === "exists",
              deliveryZoneId: "centro-id",
            }
          : {
              ...result.extracted,
              channel: "AIQFOME",
              updateExisting: blocked === "exists",
            }
      );
      assert.deepEqual(result.reread, result.extracted);
      assert.match(
        result.success,
        blocked === "exists"
          ? /Pedido atualizado no KDS/
          : /Pedido enviado à cozinha/
      );
      assert.equal(result.changedNumber, "2");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
