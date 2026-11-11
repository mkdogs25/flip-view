/* Drives the harness in headless Chromium and saves screenshots to dev/shots. */
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
  const only = process.argv[2];
  const scenarios = {
    async lightHand(page) {
      await page.goto(url("theme=light&mode=handwritten"));
      await wait(900);
      await page.screenshot({ path: `${out}/01-light-closed.png` });
      await page.click(".fv-cover-front");
      await wait(520);
      await page.screenshot({ path: `${out}/02-light-opening.png` });
      await wait(1500);
      await page.screenshot({ path: `${out}/03-light-open-hand.png` });
      await page.keyboard.press("ArrowRight");
      await wait(420);
      await page.screenshot({ path: `${out}/04-light-turning.png` });
      await wait(900);
      await page.screenshot({ path: `${out}/05-light-page2.png` });
      await page.click('.fv-seg-btn[data-mode="text"]');
      await wait(900);
      await page.screenshot({ path: `${out}/06-light-text.png` });
    },
    async darkText(page) {
      await page.goto(url("theme=dark&mode=text"));
      await wait(900);
      await page.screenshot({ path: `${out}/07-dark-closed.png` });
      await page.click(".fv-nbitem:nth-child(4)");
      await wait(900);
      await page.screenshot({ path: `${out}/08-dark-projects-closed.png` });
      await page.click(".fv-cover-front");
      await wait(2000);
      await page.screenshot({ path: `${out}/09-dark-text-open.png` });
      await page.click('.fv-seg-btn[data-mode="handwritten"]');
      await wait(900);
      await page.screenshot({ path: `${out}/10-dark-hand-open.png` });
    },
    async covers(page) {
      for (const style of ["cosmic", "leather", "linen", "marble", "geometric"]) {
        await page.goto(url(`theme=light&cover=${style}`));
        await wait(900);
        await page.screenshot({ path: `${out}/cover-${style}.png` });
      }
    },
    async lined(page) {
      await page.goto(url("theme=light&mode=handwritten&paper=lined&mess=70&font=kalam"));
      await wait(700);
      await page.click(".fv-cover-front");
      await wait(1900);
      await page.screenshot({ path: `${out}/11-lined-messy.png` });
    },
  };
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only && only !== name) continue;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`[${name}] ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`[${name}] PAGEERROR ${e.message}`));
    await fn(page);
    await page.close();
  }
  await browser.close();
  console.log(errors.length ? errors.join("\n") : "no console errors");
})();
