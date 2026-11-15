/* New note, copy highlights and sorting. */
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
  await wait(900);
  await page.click(".fv-cover-front");
  await wait(1900);

  // copy highlights: make one first
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1700);
  await page.click(".fv-tray .fv-pen:nth-child(1)");
  const box = await page.evaluate(() => {
    const pg = document.querySelector(".fv-pagebase.fv-left");
    const ir = pg.querySelector(".fv-page-inner").getBoundingClientRect();
    for (const x of pg.querySelectorAll(".fv-flow p, .fv-flow li")) {
      const a = x.getBoundingClientRect();
      if (x.textContent.length > 10 && a.left >= ir.left && a.right <= ir.right + 2 && a.top >= ir.top && a.bottom <= ir.bottom) return { x1: a.left + 3, y: a.top + 8, x2: a.left + Math.min(a.width - 3, 140) };
    }
    return null;
  });
  await page.mouse.move(box.x1, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y, { steps: 5 });
  await page.mouse.up();
  await wait(400);
  await page.keyboard.press("Escape");
  await page.click(".fv-btn-more");
  await wait(250);
  await page.click(".fv-more-item[data-id='copyhl']");
  await wait(300);
  const copied = await page.evaluate(() => window.__copied || "");
  assert(copied.startsWith("# Highlights: Physics") && copied.includes("## [[Quantum Mechanics]]") && copied.includes("> "), "copies the notebook's highlights as markdown");

  // new note
  await page.evaluate(() => (window.__prompt = "Fresh Idea"));
  await page.click(".fv-btn-more");
  await wait(250);
  await page.click(".fv-more-item[data-id='newnote']");
  await wait(1200);
  assert((await page.$$eval(".fv-ol-row .fv-ol-label", (els) => els.map((e) => e.textContent))).includes("Fresh Idea"), "a new note appears in the notebook");

  // sorting
  await page.evaluate(() => delete window.__prompt);
  const labels = () => page.$$eval(".fv-ol-row:not(.is-index):not(.is-sep) .fv-ol-label", (els) => els.map((e) => e.textContent));
  await page.click(".fv-ol-sort");
  await wait(700);
  const az = await labels();
  assert(JSON.stringify(az) === JSON.stringify([...az].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))), `the sort button puts the notes A–Z (${az.slice(0, 3)}...)`);
  await page.click(".fv-ol-sort");
  await wait(700);
  assert(JSON.stringify(await labels()) !== JSON.stringify(az), "...and the next click changes the order again");

  assert(errors.length === 0, "no errors " + errors.join("|"));
  await browser.close();
})();
