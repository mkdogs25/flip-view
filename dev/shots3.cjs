const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const out = path.join(__dirname, "shots");
fs.mkdirSync(out, { recursive: true });
const url = (qs = "") => "file://" + path.join(__dirname, "dist/harness.html") + (qs ? "?" + qs : "");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const theme of ["dark", "light"]) {
    const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
    page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`[${theme}] ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`[${theme}] PAGEERROR ${e.message}`));
    await page.goto(url(`scene=1&theme=${theme}&mode=handwritten&progress=1&seps=1&paper=lined`));
    await wait(1200);
    await page.screenshot({ path: `${out}/60-scene-${theme}-closed.png` });
    await page.click(".fv-cover-front");
    await wait(2300);
    await page.click(".fv-idx-row[data-idx='1']");
    await wait(1800);
    await page.screenshot({ path: `${out}/61-scene-${theme}-open.png` });
    await page.close();
  }
  await browser.close();
  console.log(errors.length ? errors.join("\n") : "no console errors");
})();
