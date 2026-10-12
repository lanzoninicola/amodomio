const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

for (const activate of [false, true]) {
  test(
    activate
      ? "popup explicitly activates the current Suitable tab"
      : "popup saves globals outside Suitable and preserves module settings",
    () => {
      const directory = mkdtempSync(join(tmpdir(), "suitable-popup-test-"));
      try {
        const source = readFileSync(join(__dirname, "popup.js"), "utf8");
        const html = readFileSync(join(__dirname, "popup.html"), "utf8")
          .replace(
            '<link rel="stylesheet" href="popup.css" />',
            `<style>${readFileSync(
              join(__dirname, "popup.css"),
              "utf8"
            )}</style>`
          )
          .replace(
            '<script src="popup.js"></script>',
            `<script>
        window.calls=[]; window.grants=[];
        window.saved={serverUrl:"https://amodomio.test",apiKey:"test-key",suitableOrigin:"https://suitable.test",modules:{kds:{enabled:true}}};
        window.chrome={
          storage:{local:{async get(){return window.saved}}},
          tabs:{async query(){return [{id:7,url:${JSON.stringify(
            activate ? "https://suitable.test/orders" : "edge://extensions"
          )}}]}},
          permissions:{async request(value){window.grants.push(value);return true}},
          runtime:{async sendMessage(message){
            window.calls.push(message);
            if(message.type==="suitable:configure"){Object.assign(window.saved,message.config);return {ok:true,state:"saved"}}
            return {ok:true,state:"active",message:"Integração ativada"};
          }}
        };
        ${source}
        (async()=>{
          try {
            for(let i=0;i<20&&document.querySelector("#save").disabled;i++)await new Promise(r=>setTimeout(r,10));
            const restored=document.querySelector("#server").value==="https://amodomio.test"&&document.querySelector("#key").value==="test-key";
            const initiallyActivated=window.calls.length;
            const menuVisible=!document.querySelector("nav").hidden&&document.querySelector("footer").hidden&&document.querySelector("#global-panel").hidden&&document.querySelector("#kds-panel").hidden;
            document.querySelector("#kds-tab").click();
            const panelHeight=document.querySelector("#kds-panel").getBoundingClientRect().height;
            const areaVisible=!document.querySelector("#kds-panel").hidden&&document.querySelector("#global-panel").hidden;
            document.querySelector("#back").click();
            const returnedToMenu=!document.querySelector("nav").hidden&&document.querySelector("#kds-panel").hidden;
            document.querySelector("#kds-tab").click();
            if(${activate}) {
              document.querySelector("#global-tab").click();
              document.querySelector("#activate").click();
            } else {
              document.querySelector("#kds-enabled").checked=false;
              document.querySelector("#config").requestSubmit();
            }
            for(let i=0;i<30&&!document.querySelector("#status").textContent;i++)await new Promise(r=>setTimeout(r,10));
            await new Promise(r=>setTimeout(r,30));
            document.body.dataset.result=JSON.stringify({restored,initiallyActivated,menuVisible,returnedToMenu,areaVisible,panelHeight,footerVisible:document.querySelector("#save").getBoundingClientRect().bottom<=innerHeight,calls:window.calls,grants:window.grants,saved:window.saved,status:document.querySelector("#status").textContent});
          }catch(error){document.body.dataset.result=JSON.stringify({error:error.stack})}
        })();
        </script>`
          );
        const file = join(directory, "popup.html");
        writeFileSync(file, html);
        const chrome = spawnSync(
          "google-chrome",
          [
            "--headless",
            "--window-size=800,800",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            `--user-data-dir=${directory}/profile`,
            "--virtual-time-budget=1000",
            "--dump-dom",
            `file://${file}`,
          ],
          { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 }
        );
        assert.equal(chrome.status, 0, chrome.stderr);
        const encoded = chrome.stdout.match(/data-result="([^"]+)"/)?.[1];
        assert.ok(encoded, chrome.stdout);
        const result = JSON.parse(
          encoded
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
        );
        assert.equal(result.error, undefined);
        assert.equal(result.restored, true);
        assert.equal(result.initiallyActivated, 0);
        assert.equal(result.menuVisible, true);
        assert.equal(result.returnedToMenu, true);
        assert.equal(result.areaVisible, true);
        assert.equal(result.footerVisible, true);
        assert.ok(result.panelHeight >= 350, `Panel too short: ${result.panelHeight}`);
        assert.equal(result.calls[0].type, "suitable:configure");
        if (activate) {
          assert.equal(result.calls[0].tabId, 7);
          assert.equal(result.calls[1].type, "suitable:activate");
          assert.deepEqual(result.grants[0].origins, [
            "https://amodomio.test/*",
            "https://suitable.test/*",
          ]);
        } else {
          assert.equal(result.calls.length, 1);
          assert.equal(result.calls[0].tabId, undefined);
          assert.equal(result.grants.length, 0);
          assert.equal(result.saved.modules.kds.enabled, false);
          assert.match(result.status, /Configurações salvas/);
        }
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  );
}
