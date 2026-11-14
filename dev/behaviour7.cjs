/* Frameless mode, the T and B keys, and the warm tint. */
const { chromium } = require("playwright");
const path = require("path");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL:", m);
    process.exitCode = 1;
  } else console.log("ok  :", m);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + path.join(__dirname, "dist/harness.html") + "?scene=1&theme=light&mode=handwritten");
  await wait(1000);
  await page.click(".fv-cover-front");
  await wait(2000);
  const h0 = await page.$eval(".fv-book", (e) => e.getBoundingClientRect().height);
  await page.focus(".fv-root");
  await page.keyboard.press("f");
  await wait(1800);
  assert(await page.$eval(".fv-root", (e) => e.classList.contains("fv-frameless")), "F enters frameless mode");
  for (const sel of [".fv-toolbar", ".fv-footer", ".fv-rack", ".fv-info", ".fv-topshelf", ".fv-sidebar"]) {
    assert(await page.$eval(sel, (e) => getComputedStyle(e).display === "none"), `${sel} is hidden`);
  }
  const h1 = await page.$eval(".fv-book", (e) => e.getBoundingClientRect().height);
  assert(h1 > h0 * 1.2, `the notebook grows (${Math.round(h0)} -> ${Math.round(h1)})`);
  await page.keyboard.press("Escape");
  await wait(1500);
  assert(!(await page.$eval(".fv-root", (e) => e.classList.contains("fv-frameless"))), "Esc leaves frameless mode");
  assert(await page.$eval(".fv-book", (e) => e.classList.contains("is-open")), "...without closing the notebook");
  assert(await page.$eval(".fv-toolbar", (e) => getComputedStyle(e).display !== "none"), "the controls come back");

  await page.keyboard.press("t");
  await wait(1200);
  assert((await page.evaluate(() => window.__settings.viewMode)) === "text", "T switches between handwritten and text");

  await page.evaluate(() => {
    window.__settings.pageWarmth = 60;
    window.__app.applySettings();
  });
  await wait(500);
  assert((await page.$eval(".fv-page", (e) => getComputedStyle(e).filter)).includes("sepia"), "the warm tint applies a sepia glow");

  assert(errors.length === 0, "no errors " + errors.join("|"));
  await browser.close();
})();
