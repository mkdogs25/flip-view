const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const out = path.join(__dirname, "shots");
fs.mkdirSync(out, { recursive: true });
const url = (qs = "") => "file://" + path.join(__dirname, "dist/harness.html") + (qs ? "?" + qs : "");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const only = process.argv[2];
  const mk = async (name) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`[${name}] ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`[${name}] PAGEERROR ${e.message}`));
    await page.route("https://example.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<body style='font-family:sans-serif;padding:30px'><h1>Example lesson</h1><p>An embedded page.</p></body>" }));
    return page;
  };
  const S = {
    async index(page) {
      await page.goto(url("theme=light&mode=handwritten&progress=1"));
      await wait(800);
      await page.click(".fv-cover-front");
      await wait(2200);
      await page.screenshot({ path: `${out}/40-index.png` });
      await page.click(".fv-idx-row[data-idx='2']");
      await wait(1600);
      await page.screenshot({ path: `${out}/41-after-index-click.png` });
      await page.click('.fv-seg-btn[data-mode="text"]');
      await wait(900);
      await page.screenshot({ path: `${out}/42-note-text-margin.png` });
    },
    async shelfLight(page) {
      await page.goto(url("theme=light&mode=handwritten&shelf=1&progress=1"));
      await wait(1500);
      await page.screenshot({ path: `${out}/43-shelf-light.png` });
      await page.hover(".fv-spine:nth-child(2)");
      await wait(400);
      await page.click(".fv-spine:nth-child(1)");
      for (const t of [350, 450, 450, 450]) {
        await wait(t);
        await page.screenshot({ path: `${out}/44-pull-${Date.now() % 100000}.png` });
      }
      await wait(1500);
      await page.screenshot({ path: `${out}/45-after-pull.png` });
    },
    async shelfDark(page) {
      await page.goto(url("theme=dark&mode=handwritten&shelf=1&cover=leather"));
      await wait(1500);
      await page.screenshot({ path: `${out}/46-shelf-dark.png` });
    },
    async laptop(page) {
      await page.goto(url("theme=light&mode=handwritten&progress=1"));
      await wait(800);
      await page.click(".fv-cover-front");
      await wait(1900);
      await page.click(".fv-idx-row[data-idx='1']");
      await wait(1600);
      const pos = await page.evaluate(() => {
        for (const inner of document.querySelectorAll(".fv-pagebase .fv-page-inner")) {
          const ir = inner.getBoundingClientRect();
          for (const a of inner.querySelectorAll("a")) {
            if (!/external/i.test(a.textContent || "")) continue;
            const r = (a.querySelector(".fv-w") || a).getBoundingClientRect();
            if (r.left >= ir.left && r.right <= ir.right + 1) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
        }
        return null;
      });
      let p2 = pos;
      if (!p2) {
        await page.keyboard.press("ArrowRight");
        await wait(1400);
        p2 = await page.evaluate(() => {
          for (const inner of document.querySelectorAll(".fv-pagebase .fv-page-inner")) {
            const ir = inner.getBoundingClientRect();
            for (const a of inner.querySelectorAll("a")) {
              if (!/external/i.test(a.textContent || "")) continue;
              const r = (a.querySelector(".fv-w") || a).getBoundingClientRect();
              if (r.left >= ir.left && r.right <= ir.right + 1) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
          }
          return null;
        });
      }
      if (p2) await page.mouse.click(p2.x, p2.y);
      await wait(2200);
      await page.screenshot({ path: `${out}/47-laptop.png` });
    },
    async pop(page) {
      await page.goto(url("theme=light&mode=handwritten&paper=lined"));
      await wait(800);
      await page.click(".fv-cover-front");
      await wait(1900);
      await page.click(".fv-idx-row[data-idx='1']");
      await wait(1600);
      await page.click(".fv-tray .fv-pen:nth-child(1)");
      const box = await page.evaluate(() => {
        const ws = Array.from(document.querySelectorAll(".fv-pagebase.fv-left .fv-w")).filter((w) => w.textContent && w.textContent.length > 3);
        const a = ws[3].getBoundingClientRect();
        const b = ws[6].getBoundingClientRect();
        return { x1: a.left + 2, y1: a.top + a.height / 2, x2: b.right - 2, y2: b.top + b.height / 2 };
      });
      await page.mouse.move(box.x1, box.y1);
      await page.mouse.down();
      await page.mouse.move(box.x2, box.y2, { steps: 8 });
      await page.mouse.up();
      await wait(400);
      await page.keyboard.press("Escape");
      await page.dblclick(".fv-pagebase.fv-left .fv-hl");
      await wait(400);
      await page.screenshot({ path: `${out}/48-highlight-popover.png` });
    },
    async ink(page) {
      await page.goto(url("theme=light&mode=handwritten"));
      await wait(800);
      await page.click(".fv-cover-front");
      await wait(1900);
      await page.click(".fv-idx-row[data-idx='1']");
      await wait(1600);
      await page.click(".fv-w-pen");
      await wait(300);
      const r = await page.$eval(".fv-pagebase.fv-right", (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
      const draw = async (pts) => { await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down(); for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 4 }); await page.mouse.up(); };
      await draw([[r.x + r.w * 0.3, r.y + r.h * 0.78], [r.x + r.w * 0.4, r.y + r.h * 0.72], [r.x + r.w * 0.5, r.y + r.h * 0.8], [r.x + r.w * 0.62, r.y + r.h * 0.7], [r.x + r.w * 0.74, r.y + r.h * 0.78]]);
      await page.click(".fv-w-pencil");
      await draw([[r.x + r.w * 0.2, r.y + r.h * 0.86], [r.x + r.w * 0.5, r.y + r.h * 0.9], [r.x + r.w * 0.8, r.y + r.h * 0.86]]);
      await page.click(".fv-w-marker");
      await draw([[r.x + r.w * 0.25, r.y + r.h * 0.62], [r.x + r.w * 0.7, r.y + r.h * 0.62]]);
      await page.click(".fv-w-text");
      await page.mouse.click(r.x + r.w * 0.2, r.y + r.h * 0.5);
      await wait(200);
      await page.keyboard.type("remember to check this!");
      await page.keyboard.press("Enter");
      await wait(300);
      await page.screenshot({ path: `${out}/49-ink.png` });
      console.log("annotations:", await page.evaluate(() => Object.values(window.__settings.annotations).flat().map((a) => a.kind + ":" + a.tool + (a.text ? ":" + a.text : ""))));
    },
    async looks(page) {
      await page.goto(url("theme=light&mode=handwritten&pcolor=blue&tex=laid&layout=realistic&paper=lined&cover=denim&spine=ribbed&band=double"));
      await wait(800);
      await page.screenshot({ path: `${out}/50-denim-closed.png` });
      await page.click(".fv-cover-front");
      await wait(1900);
      await page.click(".fv-idx-row[data-idx='1']");
      await wait(1600);
      await page.screenshot({ path: `${out}/51-blue-laid.png` });
    },
  };
  for (const [name, fn] of Object.entries(S)) {
    if (only && only !== name) continue;
    const page = await mk(name);
    await fn(page);
    await page.close();
  }
  await browser.close();
  console.log(errors.length ? errors.join("\n") : "no console errors");
})();
