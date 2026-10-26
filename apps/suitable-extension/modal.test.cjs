const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

for (const [width, delivery, blocked] of [
  [1440, true],
  [820, false],
  [360, false],
  [820, true],
  [360, true],
  [820, true, "aiqfome"],
  [820, true, "missing-zone"],
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
      let fixture = readFileSync(
        join(
          __dirname,
          delivery
            ? "fixtures/suitable-delivery-modal.html"
            : "fixtures/suitable-order-modal.html"
        ),
        "utf8"
      );
      if (blocked === "aiqfome")
        fixture = fixture.replace("Suitable → Terminal", "Aiqfome → aiqfome");
      const parser = readFileSync(join(__dirname, "parser.js"), "utf8");
      const content = readFileSync(join(__dirname, "content.js"), "utf8");
      const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      html {font-size:40px} body {font:70px serif;color:magenta;line-height:7}
      button,input,textarea {font-size:75px!important;background:magenta!important;width:10px!important;border:25px solid red!important}
      [role=dialog] {width:${width}px;font-family:serif;color:magenta}
      .MuiDialog-paper {display:flex;flex-direction:column;max-height:calc(100vh - 64px);overflow-y:auto}
      .MuiDialog-paper > div {flex-shrink:0}
    </style></head><body><div id="kanban"><div class="MuiPaper-root"><div class="MuiPaper-root"><div><h6>#1</h6><span>Há &lt;1m</span></div><div><div><span>Ações</span></div></div></div><span title="Nicola"><h6>Nicola</h6></span><span>+55 (46) 99105-2049</span></div></div>${fixture}<script>
      const ActualDate=Date; window.Date=class extends ActualDate { constructor(...args) { if(args.length) super(...args); else super('2026-10-11T12:00:00-03:00'); } static now(){return ActualDate.now();} };
      window.jsErrors=[];window.addEventListener("error",event=>window.jsErrors.push(event.message));const originalAttach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function(options) { return originalAttach.call(this, {...options, mode: 'open'}); };
      window.dayOpened=false;window.openCalls=0;window.checkCalls=0;
      window.chrome = { runtime: { async sendMessage(message) { if(message.type==='suitable:preferences-read') return {ok:true,kdsEnabled:true}; if(message.type==='suitable:statuses') return {ok:true,date:message.date,statuses:message.orders.map(order=>({...order,exists:false}))}; if(message.type==='suitable:customer') return {ok:true,purchaseSummary:{last:'2026-10-10T00:00:00-03:00',weekly:1.5,monthly:6}}; if(message.type==='suitable:open-day'){ window.openCalls++; await new Promise(resolve=>setTimeout(resolve,60)); if(${
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
          : true
      }}};} if(message.type==='suitable:zones') return {ok:true,zones:[{id:'morro-id',name:'${
        blocked === "missing-zone" ? "Outro bairro" : "Morro da Cruz"
      }',city:'Pato Branco'},{id:'centro-id',name:'Centro',city:'Pato Branco'}]}; window.sent = message; return {ok:true, id:'imported', status:'novoPedido'}; } } };
      ${parser}
      ${content}
      (async () => {
        await new Promise(resolve=>setTimeout(resolve,20));
        try {
          const dialog = document.querySelector('[role=dialog]');
          const headerButton = dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button');
          for(let attempt=0;attempt<30 && headerButton.disabled;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
          if(window.checkCalls!==1) throw new Error('Opening order details must query KDS once before clicking');
          if(headerButton.textContent.includes('Comanda enviada')!==${
            blocked === "exists"
          }) throw new Error('Header must reflect the existing KDS command before clicking');
          const badge = document.querySelector('[data-amodomio-card-status]');
          if(!badge || badge.dataset.state !== (${
            blocked === "exists"
          } ? 'sent' : 'missing')) throw new Error('Card badge must reflect server confirmation');
          if(!badge.title || !badge.getAttribute('aria-label')) throw new Error('Card status needs accessible description');
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
          if(!review.querySelector('.review-title')?.textContent.includes('Comanda #1')) throw new Error('Review must identify the command');
          if(!review.querySelector('.order-summary') || !review.querySelector('.order-customer-card')) throw new Error('Review needs a customer card and a side summary');
          const summaryToggle=review.querySelector('[aria-controls=order-summary]');
          const summaryPanel=review.querySelector('#order-summary');
          if(!summaryToggle || !summaryPanel.hidden || summaryToggle.getAttribute('aria-expanded')!=='false') throw new Error('Summary must start hidden with an accessible toggle');
          if(review.querySelector('.review-workspace').dataset.summary!=='false') throw new Error('Hidden summary must release its column');
          summaryToggle.click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(summaryPanel.hidden || summaryToggle.getAttribute('aria-expanded')!=='true') throw new Error('Summary button must reveal the panel');
          summaryToggle.click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(!summaryPanel.hidden) throw new Error('Summary button must hide the panel again');
          summaryToggle.click();
          await new Promise(resolve=>setTimeout(resolve,20));
          const neighborhood=review.querySelector('.delivery-zone-field');
          if(${delivery}) for(let attempt=0;attempt<30 && !neighborhood?.textContent.includes('Morro da Cruz');attempt++) await new Promise(resolve=>setTimeout(resolve,10));
          if(${blocked === "missing-zone"}) {
            for(let attempt=0;attempt<40 && !review.querySelector('.required-summary');attempt++) await new Promise(resolve=>setTimeout(resolve,10));
            if(!review.querySelector('.required-summary')?.textContent.includes('Selecione ou crie o bairro')) throw new Error('Missing neighborhood must be explained in the footer');
            if(neighborhood.querySelector('[aria-invalid=true]') == null) throw new Error('Missing neighborhood must highlight the delivery select');
            if(!review.querySelector('button[type=submit]').disabled) throw new Error('Missing neighborhood must block sending');
            if(!review.querySelector('#delivery-zone-required')?.textContent.includes('Bairro obrigatório')) throw new Error('Missing neighborhood needs an inline explanation');
          }
          if(${delivery} ? !neighborhood?.textContent.includes('${
        blocked === "missing-zone" ? "Selecionar bairro" : "Morro da Cruz"
      }') : !!neighborhood) throw new Error('Header must show the neighborhood only for delivery');
          const channelTrigger=review.querySelector('[aria-labelledby=channel-label]');
          if(!channelTrigger?.textContent.includes('${
            blocked === "aiqfome" ? "AIQFOME" : "CARDAPIO"
          }')) throw new Error('Origin must follow extracted order metadata');
          if(getComputedStyle(review.querySelector('.customer-name')).fontWeight !== '700') throw new Error('Customer name must stand out');
          if(review.querySelector('.order-form-details').hidden || detail.getAttribute('aria-expanded') !== 'true') throw new Error('Details must start expanded');
          detail.click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(!review.querySelector('.order-form-details').hidden) throw new Error('Toggle must still collapse the form');
          detail.click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(review.querySelector('.order-form-details').hidden) throw new Error('Toggle must reopen the form');
          if(!review.querySelector('.order-customer-card [name=customerName]') || !review.querySelector('.order-customer-card [name=customerPhone]')) throw new Error('Customer controls must remain editable in the customer card');
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
            const trigger=review.querySelector('[aria-label="Selecionar bairro no KDS"]');
            if(!trigger) throw new Error('Delivery neighborhood must remain editable');
            for(let attempt=0;attempt<30 && trigger.disabled;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
            trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
            await new Promise(resolve=>setTimeout(resolve,30));
            const option=[...review.querySelectorAll('[role=option]')].find(element=>element.textContent.includes('Centro'));
            if(!option) throw new Error('Other registered neighborhoods must be available');
            option.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
            await new Promise(resolve=>setTimeout(resolve,30));
            if(${
              blocked === "missing-zone"
            } && review.querySelector('#delivery-zone-required')) throw new Error('Selecting a neighborhood must clear its error');
            if(!trigger.textContent.includes('Centro') || !review.querySelector('.order-summary').textContent.includes('Centro')) throw new Error('Neighborhood changes must update the side summary');
          }
          const quantityInput=review.querySelector('.quantity');
          const originalQuantity=Number(quantityInput.value);
          review.querySelector('[aria-label="Aumentar quantidade do item 1"]').click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(Number(quantityInput.value)!==originalQuantity+1 || !review.querySelector('.summary-items').textContent.includes('Qtd. '+(originalQuantity+1))) throw new Error('Quantity controls must update the input and summary through the existing callback');
          review.querySelector('[aria-label="Diminuir quantidade do item 1"]').click();
          await new Promise(resolve=>setTimeout(resolve,20));
          if(Number(quantityInput.value)!==originalQuantity) throw new Error('Decreasing quantity must restore the original count');
          if(review.querySelector('button[type=submit]').textContent.trim()!=='Enviar ao KDS') throw new Error('Submit button must say Enviar ao KDS');
            if (${["missing-day", "open-error"].includes(blocked)}) {
              for(let attempt=0;attempt<60 && review.querySelector('.order-checks').getAttribute('aria-busy')==='true';attempt++) await new Promise(resolve=>setTimeout(resolve,10));
              const column=[...review.querySelectorAll('.check-column')].find(element=>element.querySelector('h3').textContent==='Abertura dia');
              if(column.dataset.state!=='error') throw new Error('Missing day must show X');
              const opening=column.querySelector('button');
              if(!opening || opening.textContent!=='Abrir o dia') throw new Error('Missing day must offer Abrir dia next to X');
              opening.click();
              await new Promise(resolve=>setTimeout(resolve,10));
              if(column.dataset.state!=='loading' || !opening.disabled || !review.querySelector('button[type=submit]').disabled) throw new Error('Opening must wait with loading icon and disabled actions');
              for(let attempt=0;attempt<80 && !review.textContent.includes('Falha ao abrir dia') && (column.dataset.state!=='ok');attempt++) await new Promise(resolve=>setTimeout(resolve,10));
              if(${blocked === "open-error"}) {
                if(column.dataset.state!=='error' || !review.textContent.includes('Falha ao abrir dia')) throw new Error('Opening failure must retain X and show the server error');
                if(window.sent || window.openCalls!==1) throw new Error('Opening failure must not create an order');
                document.body.dataset.result=JSON.stringify({openingFailed:true});return;
              }
              if(column.dataset.state!=='ok' || column.querySelector('button')) throw new Error('Confirmed opening must change to success check and remove the action');
              if(window.openCalls!==1) throw new Error('Opening must not duplicate requests');
            }
            let isolatedPortal = null;
            if (${delivery}) {
              for(let attempt=0;attempt<30 && !review.querySelector('[aria-label="Selecionar bairro no KDS"]').textContent.includes('Centro');attempt++) await new Promise(resolve=>setTimeout(resolve,10));
              const trigger=review.querySelector('[aria-label="Selecionar bairro no KDS"]');
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
            summaryAtSide: review.querySelector('.order-summary').getBoundingClientRect().left >= review.querySelector('.review-main').getBoundingClientRect().right,
            summaryBelow: review.querySelector('.order-summary').getBoundingClientRect().top >= review.querySelector('.review-main').getBoundingClientRect().bottom,
          };
          const invalid = [...form.elements].filter(element=>element.validity && !element.validity.valid).map(element=>({name:element.name,validation:element.validationMessage,value:element.value}));
          for(let attempt=0;attempt<60 && review.querySelector('button[type=submit]').disabled;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
          if (${blocked === "shortage"}) {
            if(review.querySelector('button[type=submit]').disabled) throw new Error('Dough shortage must not block sending');
            if(!review.textContent.includes('O envio continua disponível')) throw new Error('Attendant must see an advisory shortage warning');
            if(review.querySelector('.dough-number[data-shortage="true"] strong').textContent!=='0') throw new Error('Short size must remain highlighted');
          }
          form.requestSubmit();
          for (let attempt = 0; attempt < 30 && !review.querySelector('[type=submit]')?.hidden && review.querySelector('[type=submit]'); attempt++) {
            if (review.querySelector('.message').textContent.includes('Pedido enviado')) break;
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          const success = review.querySelector('.message').textContent;
          if(!dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button').textContent.includes('Comanda enviada')) throw new Error('Successful send must update the header button');
          if(badge.dataset.state !== 'sent') throw new Error('Successful send must turn the card green');
          document.querySelector('#kanban h6').textContent = '#999';
          await new Promise(resolve => setTimeout(resolve,30));
          if(badge.dataset.state !== 'unknown') throw new Error('Recycled cards must reset confirmation');
          // Read again after the extension inserts its own form: capture must stay unchanged.
          const reread = SuitableKds.extractModal(dialog);
          // A recycled/updated order must be read on the next click.
          dialog.querySelector('h6').textContent = 'Detalhes do pedido ordem 2';
          [...dialog.querySelectorAll('p')].find(el=>el.textContent.trim()==='Pizzas INDIVIDUAL').textContent='Pizza (Aiq)';
          dialog.querySelector('[data-amodomio-kds]').shadowRoot.querySelector('button').click();
          const changedReview = dialog.querySelector('[data-amodomio-review]').shadowRoot;
          const changedNumber = changedReview.querySelector('[name=commandNumber]').value;
          await new Promise(resolve => setTimeout(resolve, 20));
          const detailsButton = changedReview.querySelector('[aria-controls=order-details]');
          if(detailsButton.getAttribute('aria-expanded') === 'true') detailsButton.click();
          await new Promise(resolve => setTimeout(resolve, 20));
          const guidance = changedReview.querySelector('#details-guidance');
          if(!guidance || !guidance.textContent.includes('tamanho') || detailsButton.dataset.attention !== 'true') throw new Error('Missing size must highlight details and explain what to complete');
          if(guidance.getBoundingClientRect().bottom > detailsButton.getBoundingClientRect().top) throw new Error('Guidance must appear above details');
          detailsButton.click();
          await new Promise(resolve => setTimeout(resolve, 20));
          if(changedReview.querySelector('#details-guidance')) throw new Error('Opening details must dismiss guidance');
          changedReview.querySelector('[aria-label="Tamanho do item 1"] button').click();
          await new Promise(resolve => setTimeout(resolve, 20));
          const changedSize = changedReview.querySelector('[aria-label="Tamanho do item 1"] [aria-pressed=true]').textContent;
          const summary = changedReview.querySelector('.summary-items').textContent;
          if (${delivery}) {
            const changedZone = changedReview.querySelector('[aria-label="Selecionar bairro no KDS"]');
            for(let attempt=0;attempt<40 && changedZone.disabled;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
            changedZone.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
            await new Promise(resolve=>setTimeout(resolve,30));
            const correctedZone = [...changedReview.querySelectorAll('[role=option]')].find(element=>element.textContent.includes('Centro'));
            if(!correctedZone) throw new Error('Reopened delivery must offer registered neighborhoods');
            correctedZone.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
            await new Promise(resolve=>setTimeout(resolve,30));
          }
          detailsButton.click();
          await new Promise(resolve => setTimeout(resolve, 20));
          if(changedReview.querySelector('#details-guidance') || detailsButton.dataset.attention) throw new Error('Corrected required data must clear guidance: '+changedReview.querySelector('#details-guidance')?.textContent);
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
          `--window-size=${width},1100`,
          "--disable-dev-shm-usage",
          "--no-first-run",
          `--user-data-dir=${join(directory, "profile")}`,
          "--virtual-time-budget=3000",
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
      assert.ok(
        parseFloat(result.layout.inputFont) >= 13 &&
          parseFloat(result.layout.inputFont) <= 20
      );
      assert.notEqual(result.layout.inputBackground, "rgb(255, 0, 255)");
      assert.equal(result.layout.overflow, false);
      assert.equal(
        width >= 1200
          ? result.layout.summaryAtSide
          : result.layout.summaryBelow,
        true
      );
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
      assert.match(result.summary, /Tamanho F/);
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
