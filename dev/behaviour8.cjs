/* Sub-separators. */
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + path.join(__dirname, "dist/harness.html") + "?theme=light&mode=handwritten&seps=sub");
  await wait(900);
  await page.click(".fv-cover-front");
  await wait(1900);
  assert((await page.$$(".fv-ol-row.is-sep.is-sub")).length === 1, "the outline marks the sub-separator");
  assert((await page.$$(".fv-idx-section.is-sub")).length === 1, "the contents indent it");
  assert((await page.$$(".fv-tab")).length === 2, "only chapters get edge tabs");
  await page.click(".fv-ol-row.is-sub .fv-ol-label");
  await wait(1700);
  assert((await page.textContent(".fv-foot-title")).startsWith("Laws of Heat"), "it opens as its own divider page");
  assert((await page.$$(".fv-sep-tab")).length === 0, "...without an edge tab");
  await page.hover(".fv-ol-row.is-sub");
  await page.click(".fv-ol-row.is-sub button[aria-label='Delete separator']");
  await wait(600);
  assert((await page.$$(".fv-ol-row.is-sub")).length === 0, "it can be deleted");
  assert(Object.keys(await page.evaluate(() => window.__settings.subSeparators["folder:Physics"] ?? {})).length === 0, "...and its level data goes too");
  assert(errors.length === 0, "no errors " + errors.join("|"));
  await browser.close();
})();
