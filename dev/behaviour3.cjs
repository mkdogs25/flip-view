/* Shelf, index page, highlight popover, bookmarks, progress, margin notes and writing tools. */
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

async function fresh(browser, qs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text()));
  await page.goto(url(qs));
  await wait(900);
  return page;
}

(async () => {
  const browser = await chromium.launch();

  /* ---- shelf ---- */
  let page = await fresh(browser, "theme=light&mode=handwritten&shelf=1");
  assert(await page.$eval(".fv-shelf", (e) => e.classList.contains("is-open")), "shelf mode opens when enabled");
  assert((await page.$$(".fv-spine")).length === 6, "one spine per notebook");
  await wait(900);
  assert((await page.$$(".fv-spine.is-ready")).length === 6, "spine textures painted");
  await page.click(".fv-spine:nth-child(3)"); // Writing
  await wait(2600);
  assert(!(await page.$eval(".fv-shelf", (e) => e.classList.contains("is-open"))), "shelf closes after the pull-out");
  assert((await page.textContent(".fv-nbitem.is-selected .fv-nbitem-name")) === "Writing", "the picked notebook is selected on the desk");
  assert(!(await page.$eval(".fv-stage", (e) => e.classList.contains("fv-cover-hidden"))), "the cover is revealed again");
  assert((await page.$$(".fv-fly")).length === 0, "flying book cleaned up");
  await page.click(".fv-cover-front");
  await wait(1900);
  assert(await page.$eval(".fv-book", (e) => e.classList.contains("is-open")), "the notebook opens after being pulled out");
  // back to the shelf
  await page.click("button[aria-label='Show the shelf']");
  await wait(2000);
  assert(await page.$eval(".fv-shelf", (e) => e.classList.contains("is-open")), "the shelf button returns to the shelf");
  assert(page.errors.length === 0, "no errors in shelf test " + page.errors.join("|"));
  await page.close();

  /* ---- index, folios, settings ---- */
  page = await fresh(browser, "theme=light&mode=text&progress=1");
  await page.click(".fv-cover-front");
  await wait(2000);
  assert((await page.textContent(".fv-foot-title")).startsWith("Contents"), "notebooks open on the index page");
  const rows = await page.$$eval(".fv-pagebase.fv-left .fv-idx-row", (e) => e.length);
  assert(rows === 5, `index lists every note (${rows})`);
  assert((await page.$$(".fv-pagebase.fv-left .fv-idx-date")).length === 5, "index shows last-edited dates");
  await wait(5000);
  const folios = await page.$$eval(".fv-pagebase.fv-left .fv-idx-page", (e) => e.map((x) => x.textContent));
  assert(folios.length === 5 && folios.every((f) => /^\d+$/.test(f ?? "")), `page numbers become exact once measured (${folios})`);
  assert(folios[0] === "1", "first note starts on page 1");
  // customise: hide dates and page numbers
  await page.evaluate(() => {
    window.__settings.indexLastEdited = false;
    window.__settings.indexPageNumbers = false;
    window.__app.applySettings();
  });
  await wait(1200);
  assert((await page.$$(".fv-pagebase.fv-left .fv-idx-date")).length === 0, "index respects 'last edited' setting");
  assert((await page.$$(".fv-pagebase.fv-left .fv-idx-page")).length === 0, "index respects 'page numbers' setting");
  // jump
  await page.click(".fv-idx-row[data-idx='3']");
  await wait(1700);
  assert((await page.textContent(".fv-foot-title")).startsWith("Relativity"), "clicking an index entry jumps to the note");
  // read tracking
  const rs = await page.evaluate(() => Object.keys(window.__settings.readState));
  assert(rs.includes("Physics/Relativity.md"), `visited notes are tracked (${rs.length})`);
  assert((await page.$$(".fv-nbitem .fv-prog")).length >= 1, "progress shown on the notebook list");
  assert((await page.$$(".fv-recent-row")).length >= 1, "recently read list shows");
  // bookmark (the harness starts with one already)
  const marks0 = await page.evaluate(() => window.__settings.bookmarks["folder:Physics"]?.length ?? 0);
  await page.click("button[aria-label='Bookmark this page']");
  await wait(300);
  assert((await page.evaluate(() => window.__settings.bookmarks["folder:Physics"]?.length)) === marks0 + 1, "bookmark saved");
  assert(await page.$eval(".fv-ribbon", (e) => e.classList.contains("has-marks")), "ribbon shows there are bookmarks");
  await page.click("button[aria-label='Remove bookmark']");
  await wait(200);
  assert((await page.evaluate(() => window.__settings.bookmarks["folder:Physics"]?.length ?? 0)) === marks0, "bookmark removed");
  assert(page.errors.length === 0, "no errors in index test " + page.errors.join("|"));
  await page.close();

  /* ---- highlight popover and margin notes ---- */
  page = await fresh(browser, "theme=light&mode=handwritten&paper=lined");
  await page.click(".fv-cover-front");
  await wait(1900);
  await page.click(".fv-idx-row[data-idx='1']");
  await wait(1700);
  await page.click(".fv-tray .fv-pen:nth-child(1)");
  const box = await page.evaluate(() => {
    const ws = Array.from(document.querySelectorAll(".fv-pagebase.fv-left .fv-w")).filter((w) => w.textContent && w.textContent.length > 3);
    const a = ws[3].getBoundingClientRect();
    const b = ws[5].getBoundingClientRect();
    return { x1: a.left + 2, y1: a.top + a.height / 2, x2: b.right - 2, y2: b.top + b.height / 2 };
  });
  await page.mouse.move(box.x1, box.y1);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y2, { steps: 8 });
  await page.mouse.up();
  await wait(400);
  await page.keyboard.press("Escape");
  const first = '.fv-pagebase.fv-left .fv-hl';
  assert((await page.$$(first)).length > 0, "highlight made");
  await page.dblclick(first);
  await wait(300);
  assert(await page.$eval(".fv-hlpop", (e) => e.classList.contains("is-open")), "double-click opens the highlight popover");
  await page.click(".fv-hlpop-sw:nth-child(2)"); // pink
  await wait(300);
  const slot = await page.evaluate(() => Object.values(window.__settings.highlights).flat()[0].slot);
  assert(slot === 1, "popover changes the highlight colour");
  const hl = await page.$eval(first, (e) => e.style.getPropertyValue("--hl"));
  assert(hl.toLowerCase().includes("ff9ecb"), `...and the page updates (${hl})`);
  await page.fill(".fv-hlpop-note", "check this later");
  await page.keyboard.press("Enter");
  await wait(400);
  assert((await page.$$(".fv-pagebase .fv-margin-note")).length >= 2, "typing a note adds a margin note (alongside the callout one)");
  await page.dblclick(first);
  await wait(300);
  await page.click(".fv-hlpop-del");
  await wait(300);
  assert((await page.$$(first)).length === 0, "popover removes the highlight");
  assert((await page.evaluate(() => Object.keys(window.__settings.highlights).length)) === 0, "...and its saved data");
  assert(page.errors.length === 0, "no errors in highlight test " + page.errors.join("|"));

  /* ---- writing tools ---- */
  await page.click(".fv-w-pen");
  const r = await page.$eval(".fv-pagebase.fv-right", (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await page.mouse.move(r.x + r.w * 0.3, r.y + r.h * 0.85);
  await page.mouse.down();
  await page.mouse.move(r.x + r.w * 0.6, r.y + r.h * 0.88, { steps: 6 });
  await page.mouse.up();
  await wait(200);
  assert((await page.$$(".fv-pagebase .fv-stroke")).length === 1, "pen draws a stroke on the page");
  await page.click(".fv-w-eraser");
  await page.mouse.move(r.x + r.w * 0.45, r.y + r.h * 0.865);
  await page.mouse.down();
  await page.mouse.up();
  await wait(200);
  assert((await page.$$(".fv-pagebase .fv-stroke")).length === 0, "eraser removes it");
  await page.click(".fv-w-eraser"); // deselect
  await page.click('.fv-seg-btn[data-mode="text"]');
  await wait(900);
  assert(!(await page.$eval(".fv-wtray", (e) => e.classList.contains("is-disabled"))), "writing tools stay available in text view");
  await page.click(".fv-w-pen");
  const rt = await page.$eval(".fv-pagebase.fv-right", (e) => {
    const b = e.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });
  await page.mouse.move(rt.x + rt.w * 0.3, rt.y + rt.h * 0.8);
  await page.mouse.down();
  await page.mouse.move(rt.x + rt.w * 0.6, rt.y + rt.h * 0.84, { steps: 6 });
  await page.mouse.up();
  await wait(200);
  assert((await page.$$(".fv-pagebase .fv-stroke")).length === 1, "pen draws in text view too");
  assert(await page.evaluate(() => Object.keys(window.__settings.annotations).some((k) => k.startsWith("text:"))), "...kept separately from the handwritten ink");
  assert(page.errors.length === 0, "no errors in writing test " + page.errors.join("|"));
  await browser.close();
})();
