/* Editing the text of a note, hiding the shelf and the realistic pens. */
const { chromium } = require("playwright");
const path = require("path");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL:", m);
    process.exitCode = 1;
  } else console.log("ok  :", m);
};
const url = (qs) => "file://" + path.join(__dirname, "dist/harness.html") + "?" + qs;

(async () => {
  const browser = await chromium.launch();
  for (const mode of ["text", "handwritten"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url(`theme=light&mode=${mode}`));
    await wait(800);
    await page.click(".fv-cover-front");
    await wait(1800);
    await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
    await wait(1700);
    await page.click("button[aria-label^='Edit this note']");
    await wait(300);
    assert((await page.$$(".fv-editor")).length === 1, `${mode}: editor opens`);
    await page.fill(".fv-editor-area", "# Edited\n\nBrand new sentence here.");
    await page.click(".fv-editor-btn.mod-cta");
    await wait(1500);
    assert((await page.$$(".fv-editor")).length === 0, `${mode}: editor closes on save`);
    const txt = await page.$$eval(".fv-pagebase .fv-flow", (e) => e.map((x) => x.textContent).join(" "));
    assert(/Brand/.test(txt) && /new/.test(txt), `${mode}: the page shows the edited text`);
    assert(errors.length === 0, `${mode}: no errors ${errors.join("|")}`);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  await page.goto(url("scene=1&theme=dark&mode=handwritten"));
  await wait(1200);
  assert((await page.$$(".fv-tray .fv-pen svg")).length >= 3, "highlighters are detailed SVG pens");
  assert(await page.$eval(".fv-topshelf", (e) => e.getBoundingClientRect().height > 0), "shelf visible by default");
  await page.click(".fv-btn-more");
  await wait(250);
  await page.click(".fv-more-item[data-id='toggleshelf']");
  await wait(900);
  assert(await page.$eval(".fv-topshelf", (e) => getComputedStyle(e).display === "none"), "shelf can be hidden");
  assert(await page.evaluate(() => window.__settings.shelfHidden === true), "...and the choice is saved");
  // short notes share a spread
  const pk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await pk.goto(url("theme=light&mode=text"));
  await wait(800);
  await pk.click(".fv-nbitem:nth-child(4)"); // Projects: two one-page notes
  await wait(700);
  await pk.click(".fv-cover-front");
  await wait(1900);
  await pk.click(".fv-footer-open button[aria-label='Next page']");
  await wait(1400);
  assert((await pk.$$(".fv-pagebase .fv-guest")).length === 1, "two short notes share one spread");
  assert((await pk.textContent(".fv-foot-title")).includes("·"), "...and the footer names both");
  await pk.evaluate(() => {
    window.__settings.packShortNotes = false;
    window.__app.applySettings();
  });
  await wait(1500);
  assert((await pk.$$(".fv-pagebase .fv-guest")).length === 0, "packing can be switched off");
  // tools side and tilt
  assert((await pk.$eval(".fv-rack", (e) => e.dataset.side)) === "right", "tools start on the right");
  await pk.evaluate(() => {
    window.__settings.toolsSide = "left";
    window.__settings.bookTilt = 5;
    window.__app.applySettings();
  });
  await wait(500);
  assert((await pk.$eval(".fv-rack", (e) => e.dataset.side)) === "left", "tools can move to the left");
  assert((await pk.$eval(".fv-stage", (e) => e.style.getPropertyValue("--fv-tilt"))) === "5deg", "tilt follows the setting");
  await pk.close();
  await browser.close();
})();
