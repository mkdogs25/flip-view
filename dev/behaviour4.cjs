/* The scene layout: shelf of covers, info card, tabs, drawers, search. */
const { chromium } = require("playwright");
const path = require("path");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL:", m);
    process.exitCode = 1;
  } else console.log("ok  :", m);
};
const url = (qs) => "file://" + path.join(__dirname, "dist/harness.html") + "?scene=1&" + qs;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url("theme=dark&mode=handwritten&progress=1&seps=1"));
  await wait(1200);

  assert(await page.$eval(".fv-root", (e) => e.classList.contains("fv-scene")), "scene layout is active");
  assert((await page.$$(".fv-sc:not(.fv-sc-new)")).length === 6, "a cover on the shelf for every notebook");
  assert(await page.$eval(".fv-sc.is-selected", (e) => e.classList.contains("is-away")), "the notebook on the desk leaves an empty slot");
  assert(await page.$eval(".fv-sidebar", (e) => getComputedStyle(e).display === "none"), "the notebook list is a drawer, closed by default");
  assert((await page.textContent(".fv-info-name")) === "Physics", "info card shows the selected notebook");

  // pick another notebook from the shelf: flies to the desk and opens on the index
  await page.click(".fv-sc[data-id='folder:Writing']");
  await wait(600);
  assert((await page.$$(".fv-ts-flyer")).length === 1, "the cover is in flight");
  await wait(4500);
  assert((await page.$$(".fv-ts-flyer")).length === 0, "flight finished");
  assert(await page.$eval(".fv-book", (e) => e.classList.contains("is-open")), "the notebook opens after landing");
  assert((await page.textContent(".fv-info-name")) === "Writing", "info card follows the new notebook");
  assert(await page.$eval(".fv-sc[data-id='folder:Physics']", (e) => !e.classList.contains("is-away")), "the previous notebook is back on the shelf");
  assert(await page.$eval(".fv-sc[data-id='folder:Writing']", (e) => e.classList.contains("is-away")), "the new one has left its slot");

  // info card controls
  await page.selectOption(".fv-info-select >> nth=1", "grid");
  await wait(800);
  assert((await page.evaluate(() => window.__settings.paperStyle)) === "grid", "info card changes the ruling");
  assert(await page.$eval(".fv-stage", (e) => e.classList.contains("fv-paper-grid")), "...and the page follows");
  await page.click(".fv-info-toggle >> text=Show Page Numbers");
  await wait(400);
  assert((await page.evaluate(() => window.__settings.showPageNumbers)) === false, "page numbers can be switched off");
  assert(await page.$eval(".fv-stage", (e) => e.classList.contains("fv-nofolio")), "...and disappear from the pages");
  await page.click(".fv-info-head");
  await wait(300);
  assert(await page.$eval(".fv-info", (e) => e.classList.contains("is-collapsed")), "the info card collapses");

  // search
  await page.click(".fv-btn-search");
  await wait(300);
  await page.fill(".fv-searchpop input", "thermo");
  await wait(200);
  assert((await page.$$(".fv-searchpop .fv-sr-row")).length >= 1, "search finds notes");
  await page.keyboard.press("Enter");
  await wait(4500);
  assert((await page.$eval(".fv-sc.is-away", (e) => e.dataset.id)) === "folder:Physics", "search jumps into the right notebook");
  assert((await page.textContent(".fv-foot-title")) === "Thermodynamics", "...at the right note");

  // tabs: Physics has a separator in the harness (seps=1)
  assert((await page.$$(".fv-tab")).length >= 2, "index tabs appear on the book when there are sections");
  await page.click(".fv-tab >> nth=1");
  await wait(1700);
  assert((await page.textContent(".fv-foot-title")) === "Part Two: Heat", "clicking a tab jumps to that section");

  // drawers
  await page.click("button[aria-label='Toggle notebook list']");
  await wait(400);
  assert(await page.$eval(".fv-sidebar", (e) => getComputedStyle(e).display !== "none"), "the list drawer slides open");
  await page.click("button[aria-label='Toggle notebook list']");

  // fold the shelf
  const before = await page.$eval(".fv-book", (e) => e.getBoundingClientRect().height);
  await page.click(".fv-ts-fold");
  await wait(1200);
  const after = await page.$eval(".fv-book", (e) => e.getBoundingClientRect().height);
  assert(after > before, `folding the shelf gives the book more room (${Math.round(before)} -> ${Math.round(after)})`);
  await page.click(".fv-ts-fold");
  await wait(900);

  // full shelf mode button
  await page.click(".fv-ts-full");
  await wait(2200);
  assert(await page.$eval(".fv-shelf", (e) => e.classList.contains("is-open")), "Shelf Mode opens the full shelf");

  assert(errors.length === 0, "no errors " + errors.join("|"));
  await browser.close();
})();
