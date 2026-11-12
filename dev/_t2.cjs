const { chromium } = require("playwright");
(async()=>{const b=await chromium.launch();
for (const [qs,name] of [["scene=1&theme=light&mode=handwritten","scene-right"],["theme=dark&mode=handwritten","classic-right"]]){
const p=await b.newPage({viewport:{width:1672,height:941}});
await p.goto("file://"+__dirname+"/dist/harness.html?"+qs);await p.waitForTimeout(1000);
await p.click(".fv-cover-front");await p.waitForTimeout(2000);
await p.click(".fv-w-pen");await p.waitForTimeout(500);
await p.screenshot({path:__dirname+"/shots/73-"+name+".png"});
await p.evaluate(()=>{window.__settings.toolsSide="left";window.__settings.bookTilt=30;window.__app.applySettings();});await p.waitForTimeout(900);
await p.screenshot({path:__dirname+"/shots/73-"+name+"-left.png"});await p.close();}
await b.close();})();
