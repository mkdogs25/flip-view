/* Link following, the laptop and the three page-turning modes. */
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
const shots = path.join(__dirname, "shots");

async function fresh(browser, qs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.route("https://example.com/**", (r) =>
    r.fulfill({ contentType: "text/html", body: "<body style='font-family:sans-serif;padding:30px'><h1>Example lesson</h1><p>An embedded page.</p></body>" }),
  );
  await page.goto(url(qs));
  await wait(700);
  return page;
}
const footTitle = (page) => page.textContent(".fv-foot-title");
const selected = (page) => page.textContent(".fv-nbitem.is-selected .fv-nbitem-name");
const pageNums = (page) => page.$$eval(".fv-pagebase .fv-page-no", (els) => els.map((e) => e.textContent).join(","));

(async () => {
  const browser = await chromium.launch();

  /* ---- links ---- */
  let page = await fresh(browser, "theme=light&mode=handwritten&paper=lined");
  await page.click(".fv-cover-front");
  await wait(1800);
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label"); // the book opens on the index; go to the first note
  await wait(1700);
  // clicks a link that is actually visible inside a page (pages are clipped clones, so hidden-column copies exist too)
  const link = (text) => ({
    click: async () => {
      const pos = await page.evaluate((t) => {
        for (const inner of document.querySelectorAll(".fv-pagebase .fv-page-inner")) {
          const ir = inner.getBoundingClientRect();
          for (const a of inner.querySelectorAll("a")) {
            if (!(a.textContent || "").toLowerCase().includes(t.toLowerCase())) continue;
            const r = (a.querySelector(".fv-w") || a).getBoundingClientRect(); // first word: links can wrap over lines
            if (r.left >= ir.left && r.right <= ir.right + 1 && r.top >= ir.top && r.bottom <= ir.bottom + 1) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
        }
        return null;
      }, text);
      if (!pos) throw new Error("link not visible: " + text);
      await page.mouse.click(pos.x, pos.y);
    },
  });

  await link("Thermodynamics").click();
  await wait(1600);
  assert((await footTitle(page)).startsWith("Thermodynamics"), "link to a note in the same notebook flips to it");

  // go back to Quantum Mechanics through the contents to click the next links
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1600);
  await link("time dilation").click();
  await wait(1800);
  const t = await footTitle(page);
  const heads = await page.$$eval(".fv-pagebase .fv-flow h2", (els) => els.map((e) => e.textContent));
  assert(t === "Relativity" && heads.some((h) => /Time Dilation/i.test(h)), `heading link lands on the page with the heading (${t}; ${heads})`);

  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1600);
  await link("Garden Plan").click();
  await wait(4200);
  assert((await selected(page)) === "Projects", "link to a note in another notebook switches notebook");
  assert((await footTitle(page)).startsWith("Garden Plan"), `...and opens it (${await footTitle(page)})`);

  // external link -> laptop
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1500);
  const before = await page.$eval(".fv-bookwrap", (e) => e.getBoundingClientRect().left);
  assert((await selected(page)) === "Projects", "(still in Projects)");
  await page.click(".fv-nbitem:nth-child(1)");
  await wait(600);
  await page.click(".fv-cover-front");
  await wait(1800);
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1700);
  await page.keyboard.press("ArrowRight");
  await wait(1300);
  await link("external page").click();
  await wait(1700);
  assert(await page.$eval(".fv-laptop", (e) => e.classList.contains("is-open")), "external link opens the laptop");
  assert((await page.$eval(".fv-laptop iframe", (e) => e.src)) === "https://example.com/lesson", "laptop loads the link");
  const scaled = await page.$eval(".fv-bookwrap", (e) => getComputedStyle(e).transform);
  assert(scaled !== "none", `notebook moved aside (${scaled})`);
  await page.screenshot({ path: `${shots}/30-laptop.png` });
  await page.keyboard.press("Escape");
  await wait(1200);
  assert(!(await page.$eval(".fv-laptop", (e) => e.classList.contains("is-open"))), "Escape closes the laptop");
  assert((await page.$eval(".fv-bookwrap", (e) => getComputedStyle(e).transform)) === "none", "notebook returns to the middle");
  assert(page.errors.length === 0, "no page errors in links test " + page.errors.join("|"));
  await page.close();

  /* ---- flip modes ---- */
  // click mode
  page = await fresh(browser, "theme=light&mode=text&flip=click");
  await page.click(".fv-cover-front");
  await wait(1800);
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1700);
  const p0 = await pageNums(page);
  await page.mouse.click(1000, 450); // right page body
  await wait(1300);
  const p1 = await pageNums(page);
  assert(p0 !== p1, `click mode: clicking the right page flips forward (${p0} -> ${p1})`);
  await page.mouse.click(420, 450);
  await wait(1300);
  assert((await pageNums(page)) === p0, "click mode: clicking the left page flips back");
  await page.close();

  // nav mode
  page = await fresh(browser, "theme=light&mode=text&flip=nav");
  await page.click(".fv-cover-front");
  await wait(1800);
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1700);
  const n0 = await pageNums(page);
  await page.mouse.click(1000, 450);
  await wait(1200);
  assert((await pageNums(page)) === n0, "nav mode: clicking a page does nothing");
  await page.click(".fv-footer-open button[aria-label='Next page']");
  await wait(1300);
  assert((await pageNums(page)) !== n0, "nav mode: nav bar still flips");
  await page.close();

  // drag mode
  page = await fresh(browser, "theme=light&mode=text&flip=drag");
  await page.click(".fv-cover-front");
  await wait(1800);
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1700);
  const d0 = await pageNums(page);
  const edge = await page.$eval(".fv-edge-right", (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  // short pull and release: snaps back
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await page.mouse.move(edge.x - 60, edge.y, { steps: 5 });
  await page.screenshot({ path: `${shots}/31-drag-partial.png` });
  await page.mouse.up();
  await wait(900);
  assert((await pageNums(page)) === d0, "drag mode: a short pull snaps back");
  // long pull: turns
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await page.mouse.move(edge.x - 250, edge.y, { steps: 8 });
  await page.screenshot({ path: `${shots}/32-drag-mid.png` });
  await page.mouse.move(edge.x - 700, edge.y, { steps: 8 });
  await page.mouse.up();
  await wait(1100);
  assert((await pageNums(page)) !== d0, "drag mode: pulling past halfway turns the page");
  assert((await page.$$(".fv-leaf")).length === 0, "drag mode: leaf cleaned up");
  assert(page.errors.length === 0, "no page errors in flip test " + page.errors.join("|"));
  await browser.close();
})();
