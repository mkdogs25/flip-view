/* Go to page, text size keys, swipe turning and the rain toggle. */
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
  await page.goto("file://" + path.join(__dirname, "dist/harness.html") + "?theme=light&mode=text&progress=1");
  await wait(900);
  await page.click(".fv-cover-front");
  await wait(1900);
  await wait(6000); // let every note be laid out so page numbers are exact
  await page.focus(".fv-root");

  // go to page
  await page.evaluate(() => (window.__prompt = "4"));
  await page.keyboard.press("g");
  await wait(2200);
  const printed = await page.$$eval(".fv-pagebase .fv-page-no", (els) => els.map((e) => e.textContent));
  assert(printed.includes("4"), `G jumps to a printed page number (${printed})`);

  // text size
  const s0 = await page.evaluate(() => window.__settings.textSize);
  await page.focus(".fv-root");
  await page.keyboard.press("+");
  await wait(1500);
  assert((await page.evaluate(() => window.__settings.textSize)) === s0 + 5, "+ makes the text bigger");
  await page.keyboard.press("-");
  await wait(1200);
  assert((await page.evaluate(() => window.__settings.textSize)) === s0, "- makes it smaller again");

  // swipe left turns the page forwards
  const before = await page.textContent(".fv-foot-title");
  const swiped = await page.evaluate(async () => {
    const book = document.querySelector(".fv-book");
    const r = book.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const mk = (type, x) => new PointerEvent(type, { pointerType: "touch", clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerId: 7 });
    book.dispatchEvent(mk("pointerdown", r.left + r.width * 0.8));
    book.dispatchEvent(mk("pointerup", r.left + r.width * 0.3));
    return true;
  });
  await wait(1400);
  assert(swiped && (await page.textContent(".fv-foot-title")) !== before, "swiping across the book turns the page");

  // rain toggle
  await page.click(".fv-btn-more");
  await wait(250);
  assert((await page.$$(".fv-more-item[data-id='rain']")).length === 1, "the menu offers rain sounds");
  await page.click(".fv-more-item[data-id='rain']");
  await wait(300);
  assert((await page.evaluate(() => window.__settings.ambientRain)) === true, "rain can be switched on");

  assert(errors.length === 0, "no errors " + errors.join("|"));
  await browser.close();
})();
