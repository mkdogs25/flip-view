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
  const owners = await pk.$$eval(".fv-pagebase .fv-page", (els) => els.map((e) => e.dataset.noteIdx));
  assert(owners.length === 2 && owners[0] !== owners[1], `the contents page and the first note share a spread (${owners})`);
  assert((await pk.textContent(".fv-foot-title")).includes("·"), "...and the footer names both");
  assert(owners.join() === "0,1", "the contents page is followed straight away by the first note");
  // ink and highlights on the right-hand page belong to the note on that page
  await pk.click(".fv-w-pen");
  const rr = await pk.$eval(".fv-pagebase.fv-right", (e) => {
    const b = e.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });
  await pk.mouse.move(rr.x + rr.w * 0.2, rr.y + rr.h * 0.8);
  await pk.mouse.down();
  await pk.mouse.move(rr.x + rr.w * 0.7, rr.y + rr.h * 0.85, { steps: 6 });
  await pk.mouse.up();
  await wait(300);
  assert((await pk.evaluate(() => Object.keys(window.__settings.annotations))).some((k) => k.includes("Projects/") && !k.includes("index")), "ink on the right page is saved against that page's note");
  await pk.click(".fv-w-pen");
  await wait(900); // the book tilts back while the pen is put down
  await pk.click(".fv-tray .fv-pen:nth-child(1)");
  const hbox = await pk.evaluate(() => {
    const pg = document.querySelector(".fv-pagebase.fv-right");
    const ir = pg.querySelector(".fv-page-inner").getBoundingClientRect();
    for (const x of pg.querySelectorAll(".fv-flow p, .fv-flow li")) {
      const a = x.getBoundingClientRect();
      if (x.textContent.length > 10 && a.left >= ir.left && a.right <= ir.right + 2 && a.top >= ir.top && a.bottom <= ir.bottom) return { x1: a.left + 3, y: a.top + 8, x2: a.left + Math.min(a.width - 3, 140) };
    }
    return null;
  });
  if (hbox) {
    await pk.mouse.move(hbox.x1, hbox.y);
    await pk.mouse.down();
    await pk.mouse.move(hbox.x2, hbox.y, { steps: 5 });
    await pk.mouse.up();
    await wait(400);
  }
  assert(Object.keys(await pk.evaluate(() => window.__settings.highlights)).some((k) => k.startsWith("Projects/")), "a highlight on the right page is saved against that page's note");
  await pk.keyboard.press("Escape");
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
