/* Light pages in dark mode, custom margins, closing the laptop, wheel and Home/End keys. */
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

(async () => {
  const browser = await chromium.launch();
  let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://example.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<h1>Example</h1>" }));
  await page.goto(url("theme=dark&mode=handwritten&paper=lined"));
  await wait(900);
  await page.click(".fv-cover-front");
  await wait(1900);
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1700);
  const paper = () => page.$eval(".fv-page", (e) => getComputedStyle(e).backgroundColor);
  const dark = await paper();
  await page.evaluate(() => {
    window.__settings.lightPagesInDark = true;
    window.__app.applySettings();
  });
  await wait(800);
  const light = await paper();
  assert(dark !== light && /rgb\((24\d|2[3-5]\d), (2\d\d), (2\d\d)\)/.test(light), `pages turn light in dark mode (${dark} -> ${light})`);
  await page.screenshot({ path: `${shots}/80-lightpages.png` });

  // margins
  const iw0 = await page.$eval(".fv-stage", (e) => parseFloat(e.style.getPropertyValue("--fv-iw")));
  await page.evaluate(() => {
    window.__settings.marginInner = 200;
    window.__settings.marginOuter = 150;
    window.__app.applySettings();
  });
  await wait(1500);
  const iw1 = await page.$eval(".fv-stage", (e) => parseFloat(e.style.getPropertyValue("--fv-iw")));
  assert(iw1 < iw0, `wider margins narrow the text (${Math.round(iw0)} -> ${Math.round(iw1)})`);
  await page.evaluate(() => {
    window.__settings.marginInner = 100;
    window.__settings.marginOuter = 100;
    window.__app.applySettings();
  });
  await wait(1200);

  // Home / End
  await wait(1500);
  await page.focus(".fv-root");
  await page.keyboard.press("End");
  await wait(1700);
  assert((await page.textContent(".fv-foot-title")) === "Fluid Dynamics", "End jumps to the last note");
  await page.keyboard.press("Home");
  await wait(1700);
  assert((await page.textContent(".fv-foot-title")) === "Contents", "Home jumps to the first page");

  // wheel flipping
  await page.evaluate(() => {
    window.__settings.wheelFlip = true;
    window.__app.applySettings();
  });
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 200);
  await wait(1500);
  assert((await page.textContent(".fv-foot-title")) !== "Contents", "the wheel turns pages when switched on");
  await page.close();

  // closing the laptop
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://example.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<h1>Example</h1>" }));
  await page.goto(url("theme=light&mode=handwritten&paper=lined"));
  await wait(800);
  await page.click(".fv-cover-front");
  await wait(1800);
  await page.click(".fv-ol-row:nth-child(2) .fv-ol-label");
  await wait(1700);
  const pos = await page.evaluate(() => {
    for (const inner of document.querySelectorAll(".fv-pagebase .fv-page-inner")) {
      const ir = inner.getBoundingClientRect();
      for (const a of inner.querySelectorAll("a")) {
        if (!(a.textContent || "").toLowerCase().includes("external page")) continue;
        const r = (a.querySelector(".fv-w") || a).getBoundingClientRect();
        if (r.left >= ir.left && r.right <= ir.right + 1 && r.top >= ir.top && r.bottom <= ir.bottom + 1) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return null;
  });
  if (pos) await page.mouse.click(pos.x, pos.y);
  await wait(1700);
  assert(await page.$eval(".fv-laptop", (e) => e.classList.contains("is-open")), "laptop opens");
  assert(await page.$eval(".fv-laptop-exit", (e) => getComputedStyle(e).display !== "none"), "a close-laptop button is shown");
  await page.click(".fv-laptop-exit");
  await wait(1300);
  assert(!(await page.$eval(".fv-laptop", (e) => e.classList.contains("is-open"))), "the button closes the laptop");
  assert((await page.$eval(".fv-bookwrap", (e) => getComputedStyle(e).transform)) === "none", "...and the notebook is back to full size");
  assert((await page.$$(".fv-deskmat")).length === 0, "the desk mat is gone");

  assert(errors.length === 0, "no errors " + errors.join("|"));
  await browser.close();
})();
