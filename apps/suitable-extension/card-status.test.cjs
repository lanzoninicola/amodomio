const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildSync } = require("esbuild");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
test("board checks once, refreshes only on chip click and protects newer send confirmation", () => {
  const directory = mkdtempSync(join(tmpdir(), "kds-card-status-"));
  try {
    const source = buildSync({
      entryPoints: [join(__dirname, "src/card-status.ts")],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "Cards",
    }).outputFiles[0].text;
    const card = (number, phone, extra = "") =>
      `<div class="MuiPaper-root" ${extra}><div class="MuiPaper-root"><h6>#${number}</h6><div><div><span>Ações</span></div></div></div><h6>Nome diferente</h6><span>${phone}</span></div>`;
    const file = join(directory, "test.html");
    writeFileSync(
      file,
      `<!doctype html><body>${card(1, "+55 (46) 99105-2049")}${card(
        2,
        "46999990000"
      )}${card(3, "")}${card(4, "46988880000", 'style="display:none"')}<script>
      const actualNow=Date.now; let offset=0; Date.now=()=>actualNow()+offset;
      window.setInterval=()=>{throw Error('Periodic polling is not allowed')};
      ${source}
      (async()=>{
        const wait=()=>new Promise(resolve=>setTimeout(resolve,450));
        const assert=(value,message)=>{if(!value)throw Error(message)};
        const badges=()=>[...document.querySelectorAll('[data-amodomio-card-status]')];
        const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
        const get=type=>parts.find(p=>p.type===type).value; const date=get('year')+'-'+get('month')+'-'+get('day');
        let calls=0, mode='normal', release;
        Cards.configureCardStatusChecks(async (day,orders,force)=>{
          calls++; assert(orders.length===(calls===1?2:1),'must query only due cards'); if(calls>1)assert(force,'chip click must bypass persisted cache');
          if(mode==='error')throw Error('Servidor indisponível');
          if(mode==='slow')await new Promise(resolve=>release=resolve);
          return {ok:true,date:day,statuses:orders.map(order=>({...order,exists:mode==='slow'?false:order.commandNumber===1}))};
        });
        try {
          Cards.scanCardStatuses(true); await wait();
          assert(calls===1,'must query without opening any modal');
          assert(badges()[0].dataset.state==='sent','matching order turns green');
          assert(badges()[1].dataset.state==='missing','missing order turns red');
          assert(badges()[2].dataset.state==='unknown','missing phone stays unknown');
          Cards.scanCardStatuses(); await wait(); assert(calls===1,'DOM rescans must use cache');
          offset+=31000; Cards.scanCardStatuses(); await wait(); assert(calls===1,'elapsed time must not trigger another query'); mode='error'; badges()[0].click(); await wait();
          assert(calls===2 && badges()[0].dataset.state==='unknown','failed refresh clears stale green');
          assert(badges()[0].title.includes('Servidor indisponível'),'error must be explained');
          offset+=31000; mode='slow'; badges()[0].click(); await wait();
          Cards.updateCardStatus({date,commandNumber:1,customerPhone:'46991052049'},'sent');
          release(); await new Promise(resolve=>setTimeout(resolve,20));
          assert(badges()[0].dataset.state==='sent','older automatic result cannot overwrite manual success');
          Cards.scanCardStatuses(false); assert(!badges().length,'disabling integration removes chips');
          document.body.dataset.result='ok';
        }catch(error){document.body.dataset.result=error.stack;}
      })();
    </script>`
    );
    const result = spawnSync(
      process.env.CHROME_BIN || "/usr/bin/google-chrome",
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        `--user-data-dir=${join(directory, "profile")}`,
        "--virtual-time-budget=3500",
        "--dump-dom",
        `file://${file}`,
      ],
      { encoding: "utf8", timeout: 30000, maxBuffer: 5 * 1024 * 1024 }
    );
    assert.equal(result.status, 0, result.stderr);
    const match = result.stdout.match(/data-result="([^"]*)"/);
    assert.equal(match?.[1], "ok", match?.[1] || "Missing browser result");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
