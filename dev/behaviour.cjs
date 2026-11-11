/* Behavioural checks against the harness: rename, reorder, separators, highlight add/remove. */
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
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("file://" + path.join(__dirname, "dist/harness.html") + "?theme=light&mode=text");
  await wait(800);

  // rename a notebook (harness prompt returns "<name> (renamed)")
  await page.hover(".fv-nbitem:nth-child(1)");
  await page.click(".fv-nbitem:nth-child(1) .fv-nbitem-rename");
  await wait(300);
  const name = await page.textContent(".fv-nbitem:nth-child(1) .fv-nbitem-name");
  assert(name === "Physics (renamed)", `rename shows in sidebar (${name})`);
  assert((await page.evaluate(() => window.__settings.notebookNames["folder:Physics"])) === "Physics (renamed)", "rename stored by notebook id");

  // open, reorder with the move-down button
  await page.click(".fv-cover-front");
  await wait(1700);
  const titles = () => page.$$eval(".fv-ol-row .fv-ol-label", (els) => els.map((e) => e.textContent));
  const before = await titles();
  await page.hover(".fv-ol-row:nth-child(2)");
  await page.click(".fv-ol-row:nth-child(2) button[aria-label='Move down']");
  await wait(600);
  const after = await titles();
  assert(before[0] === "Contents" && after[0] === "Contents", "the index page stays first");
  assert(after[1] === before[2] && after[2] === before[1], `reorder swaps first two notes (${before[1]} <-> ${before[2]})`);
  assert((await page.evaluate(() => window.__settings.noteOrder["folder:Physics"])).length === 5, "order persisted");

  // add separator after current note
  await page.click(".fv-ol-add");
  await wait(600);
  const withSep = await titles();
  assert(withSep.length === 7 && withSep.includes("New Chapter"), "separator added");
  assert((await page.$$eval(".fv-ol-row.is-sep", (e) => e.length)) === 1, "outline marks the separator row");

  // delete it again
  await page.hover(".fv-ol-row.is-sep");
  await page.click(".fv-ol-row.is-sep button[aria-label='Delete separator']");
  await wait(500);
  assert((await titles()).length === 6, "separator deleted");

  // highlight + remove by clicking with the pen active (go to a note page first; the book opens on the index)
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1700);
  await page.click(".fv-tray .fv-pen:nth-child(2)");
  const box = await page.evaluate(() => {
    const ps = Array.from(document.querySelectorAll(".fv-pagebase.fv-left p, .fv-pagebase.fv-left li")).filter((w) => w.textContent && w.textContent.length > 3);
    const r = ps[0].getBoundingClientRect();
    return { x1: r.left + 3, y: r.top + 9, x2: r.left + Math.min(r.width - 3, 120) };
  });
  await page.mouse.move(box.x1, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y, { steps: 5 });
  await page.mouse.up();
  await wait(300);
  assert((await page.$$(".fv-pagebase .fv-hl")).length > 0, "highlight drawn on page");
  await page.click(".fv-pagebase .fv-hl");
  await wait(300);
  assert((await page.$$(".fv-pagebase .fv-hl")).length === 0, "clicking a highlight with the pen removes it");
  assert(Object.keys(await page.evaluate(() => window.__settings.highlights)).length === 0, "highlight removed from settings");

  // page turn with sound on does not throw; pages rebuild on mode switch
  await page.keyboard.press("Escape"); // drop the pen
  await page.keyboard.press("ArrowRight");
  await wait(1200);
  await page.click('.fv-seg-btn[data-mode="handwritten"]');
  await wait(900);
  assert((await page.$$(".fv-pagebase .fv-flow")).length === 2, "pages rebuilt in handwritten mode");

  assert(errors.length === 0, `no console errors ${errors.join(" | ")}`);
  await browser.close();
})();
