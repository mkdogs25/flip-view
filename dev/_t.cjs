const { chromium } = require("playwright");
(async()=>{const b=await chromium.launch();
for (const mode of ["text","handwritten"]) {
const p=await b.newPage({viewport:{width:1440,height:900}});
p.on("pageerror",e=>console.log("ERR",e.message));
await p.goto("file://"+__dirname+"/dist/harness.html?theme=light&mode="+mode+"&paper=lined");await p.waitForTimeout(900);
await p.click(".fv-nbitem:nth-child(4)");await p.waitForTimeout(700); // Writing (4 short notes)
await p.click(".fv-cover-front");await p.waitForTimeout(1900);
for (let k=0;k<6;k++){
  const info = await p.evaluate(()=>[document.querySelector(".fv-foot-title").textContent, document.querySelector(".fv-foot-count").textContent, Array.from(document.querySelectorAll(".fv-pagebase .fv-page")).map(pg=>(pg.className.includes("guest")?"G:":"")+(pg.querySelector(".fv-page-no")?.textContent||"-")+":"+(pg.querySelector(".fv-flow")?.textContent||"").trim().slice(0,18)).join(" || ")]);
  console.log(mode, info.join(" | "));
  const nx=await p.$(".fv-footer-open button[aria-label='Next page']"); if(await nx.isDisabled()) break;
  await nx.click(); await p.waitForTimeout(1300);
}
if(mode==="text") await p.screenshot({path:__dirname+"/shots/75-packed.png"});
await p.close();}
await b.close();})();
