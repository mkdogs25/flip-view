import { App, Modal, Notice, Setting } from "obsidian";
import { BandStyle, CoverStyle, CustomCover, FlipViewSettings, Notebook, PaperColor, SpineStyle } from "./types";

export class NewNotebookModal extends Modal {
  private name = "";

  constructor(app: App, private hint: string, private onSubmit: (name: string) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText("New notebook");
    contentEl.createEl("p", { text: this.hint, cls: "setting-item-description" });
    const submit = () => {
      const n = this.name.trim().replace(/[\\/:*?"<>|]/g, "");
      if (!n) return;
      this.close();
      this.onSubmit(n);
    };
    new Setting(contentEl).setName("Name").addText((t) => {
      t.setPlaceholder("Physics").onChange((v) => (this.name = v));
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      window.setTimeout(() => t.inputEl.focus(), 30);
    });
    new Setting(contentEl).addButton((b) => b.setButtonText("Create").setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class HelpModal extends Modal {
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText("Flip View");
    const ul = contentEl.createEl("ul");
    [
      "Pick a notebook on the left, then click its cover to flip it open. The shelf button (next to the sidebar button) shows all your notebooks on a shelf; click a spine to pull one out.",
      "Along the top, covers of all your notebooks stand on a shelf: click one and it slides onto the desk. The Notebook Info card has quick appearance controls. Press / to search every note.",
      "Every notebook starts with a contents page: click an entry to jump to that note. If you've added separator pages, coloured tabs on the book's edge jump to each section.",
      "Keys: ←/→ turn pages, Home/End jump to the first/last note, F hides every control (frameless mode), T switches handwritten/text, B bookmarks the page, / searches, Esc closes the laptop, a pen or the notebook. You can also turn pages with the mouse wheel (settings). The pencil button under the book edits the note's text.",
      "In either view the tool rack (either side of the desk, your choice) lets you draw and type on the pages; double-click a highlight to recolour it, add a margin note, or remove it.",
      "Turn pages with the arrow keys, the page edges, or the arrows under the book. Turning back past the first page closes the notebook.",
      "Switch between Handwritten and Text at the top. Text uses your own note font; handwriting is generated from the same text.",
      "Links in your notes work inside the book: a link to another note flips to it (or moves to its notebook), and a web link opens on a laptop on the desk. Ctrl/Cmd-click opens the real note or your browser.",
      "Choose how pages turn in settings: click a page, pull its corner, or use only the navigation bar.",
      "The list button under the book jumps to any note. The page icon opens the note itself.",
      "Click the dice on a closed notebook to shuffle its cover. Covers are generated randomly per notebook, with no AI involved.",
      "The outline on the right lists the notebook's notes. Drag rows (or use the arrows) to reorder them, and add separator pages between notes. Headings and highlights of the open note are listed under it.",
      "Highlighters sit on the desk: click one, then drag over text to highlight. Click a highlight with the pen active to remove it. The sticky note is a draggable legend.",
      "Rename a notebook with the pencil beside it in the list, or restyle its cover with the palette button on its closed cover.",
      "In settings you can group notes by folder or by a property, and tune handwriting font (including cursive), heading case, size, messiness, covers, highlighters and sound.",
    ].forEach((t) => ul.createEl("li", { text: t }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class PromptModal extends Modal {
  private value: string;
  private settled = false;

  constructor(
    app: App,
    private o: { title: string; value?: string; hint?: string; placeholder?: string; resetLabel?: string },
    private done: (v: string | null) => void,
  ) {
    super(app);
    this.value = o.value ?? "";
  }

  private finish(v: string | null): void {
    if (this.settled) return;
    this.settled = true;
    this.close();
    this.done(v);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(this.o.title);
    if (this.o.hint) contentEl.createEl("p", { text: this.o.hint, cls: "setting-item-description" });
    new Setting(contentEl).setName("Name").addText((t) => {
      t.setPlaceholder(this.o.placeholder ?? "").setValue(this.value).onChange((v) => (this.value = v));
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.finish(this.value);
      });
      window.setTimeout(() => {
        t.inputEl.focus();
        t.inputEl.select();
      }, 30);
    });
    const row = new Setting(contentEl);
    if (this.o.resetLabel) row.addButton((b) => b.setButtonText(this.o.resetLabel as string).onClick(() => this.finish("")));
    row.addButton((b) => b.setButtonText("Cancel").onClick(() => this.finish(null)));
    row.addButton((b) => b.setButtonText("OK").setCta().onClick(() => this.finish(this.value)));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.done(null);
    }
  }
}

export const COVER_STYLE_OPTIONS: Array<[CoverStyle, string]> = [
  ["storybook", "Storybook (illustrated)"],
  ["random", "Random"],
  ["cosmic", "Cosmic"],
  ["leather", "Leather"],
  ["linen", "Linen"],
  ["marble", "Marble"],
  ["geometric", "Geometric"],
  ["plain", "Plain cloth"],
  ["kraft", "Kraft paper"],
  ["gradient", "Colourful gradient"],
  ["watercolor", "Watercolour"],
  ["terrazzo", "Terrazzo"],
  ["waves", "Waves"],
  ["suede", "Suede"],
  ["canvas", "Canvas"],
  ["cork", "Cork"],
  ["woodgrain", "Wood grain"],
  ["denim", "Denim"],
];

export const SPINE_OPTIONS: Array<[SpineStyle, string]> = [
  ["banded", "Gold bands"],
  ["plain", "Plain"],
  ["striped", "Striped"],
  ["foil", "Foil title"],
  ["label", "Paper label"],
  ["ribbed", "Ribbed (raised bands)"],
];

export const BAND_OPTIONS: Array<[BandStyle, string]> = [
  ["vertical", "Vertical strap"],
  ["horizontal", "Horizontal strap"],
  ["double", "Cross straps"],
  ["none", "No strap"],
];

export const PAPER_OPTIONS: Array<[PaperColor, string]> = [
  ["cream", "Cream"],
  ["white", "White"],
  ["ivory", "Ivory"],
  ["yellow", "Legal pad yellow"],
  ["grey", "Soft grey"],
  ["blue", "Blueprint blue"],
  ["sepia", "Sepia"],
  ["custom", "Custom colour"],
];

/** Per-notebook cover options: style, colour and a fresh random seed. */
export class CoverModal extends Modal {
  constructor(app: App, private s: FlipViewSettings, private nb: Notebook, private done: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const s = this.s;
    const id = this.nb.id;
    contentEl.empty();
    this.titleEl.setText(`Cover: ${this.nb.name}`);
    const ov = () => (s.coverOverrides[id] ??= {});
    const tidy = () => {
      const o = s.coverOverrides[id];
      if (o && !o.style && !o.color && !o.spine && !o.band && !o.bandColor && !o.ribbonColor && !o.paper && !o.image) delete s.coverOverrides[id];
    };

    new Setting(contentEl)
      .setName("Your own cover")
      .setDesc(s.coverOverrides[id]?.image ? "A picture you uploaded is on this cover. It is cropped to fit." : "Upload a picture (PNG, JPG, WebP…) to use as this notebook's cover. It is cropped to the cover's shape and kept in the plugin's data.")
      .addButton((b) =>
        b.setButtonText(s.coverOverrides[id]?.image ? "Replace image" : "Upload image").onClick(() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.addEventListener("change", () => {
            const file = input.files?.[0];
            if (!file) return;
            void coverFromFile(file).then(
              (img) => {
                ov().image = img;
                this.onOpen();
              },
              () => new Notice("That image could not be read."),
            );
          });
          input.click();
        }),
      )
      .addExtraButton((b) =>
        b
          .setIcon("trash")
          .setTooltip("Remove your cover and go back to the generated one")
          .onClick(() => {
            if (s.coverOverrides[id]) delete s.coverOverrides[id].image;
            tidy();
            this.onOpen();
          }),
      );

    new Setting(contentEl)
      .setName("Style")
      .setDesc("Leave on “Same as default” to follow the plugin setting.")
      .addDropdown((d) => {
        d.addOption("", "Same as default");
        COVER_STYLE_OPTIONS.forEach(([v, l]) => d.addOption(v, l));
        d.setValue(s.coverOverrides[id]?.style ?? "").onChange((v) => {
          ov().style = (v || undefined) as CoverStyle | undefined;
          tidy();
        });
      });

    new Setting(contentEl)
      .setName("Colour")
      .setDesc("Tints the cover. Reset to use the default (or a random colour).")
      .addColorPicker((c) => c.setValue(s.coverOverrides[id]?.color || s.coverColor || "#7c5cbf").onChange((v) => ((ov().color = v), tidy())))
      .addExtraButton((b) =>
        b
          .setIcon("rotate-ccw")
          .setTooltip("Reset colour")
          .onClick(() => {
            if (s.coverOverrides[id]) delete s.coverOverrides[id].color;
            tidy();
            this.onOpen();
          }),
      );

    new Setting(contentEl)
      .setName("Spine design")
      .setDesc("How the spine looks on the shelf.")
      .addDropdown((d) => {
        d.addOption("", "Same as default");
        SPINE_OPTIONS.forEach(([v, l]) => d.addOption(v, l));
        d.setValue(s.coverOverrides[id]?.spine ?? "").onChange((v) => {
          ov().spine = (v || undefined) as SpineStyle | undefined;
          tidy();
        });
      });

    new Setting(contentEl)
      .setName("Elastic strap")
      .addDropdown((d) => {
        d.addOption("", "Same as default");
        BAND_OPTIONS.forEach(([v, l]) => d.addOption(v, l));
        d.setValue(s.coverOverrides[id]?.band ?? "").onChange((v) => {
          ov().band = (v || undefined) as BandStyle | undefined;
          tidy();
        });
      })
      .addColorPicker((c) => c.setValue(s.coverOverrides[id]?.bandColor || s.bandColor || "#3a2f4d").onChange((v) => ((ov().bandColor = v), tidy())))
      .addExtraButton((b) =>
        b
          .setIcon("rotate-ccw")
          .setTooltip("Reset strap colour")
          .onClick(() => {
            if (s.coverOverrides[id]) delete s.coverOverrides[id].bandColor;
            tidy();
            this.onOpen();
          }),
      );

    new Setting(contentEl)
      .setName("Ribbon colour")
      .addColorPicker((c) => c.setValue(s.coverOverrides[id]?.ribbonColor || s.ribbonColor).onChange((v) => ((ov().ribbonColor = v), tidy())))
      .addExtraButton((b) =>
        b
          .setIcon("rotate-ccw")
          .setTooltip("Reset ribbon colour")
          .onClick(() => {
            if (s.coverOverrides[id]) delete s.coverOverrides[id].ribbonColor;
            tidy();
            this.onOpen();
          }),
      );

    new Setting(contentEl)
      .setName("Paper")
      .setDesc("The colour of this notebook's pages.")
      .addDropdown((d) => {
        d.addOption("", "Same as default");
        PAPER_OPTIONS.filter(([v]) => v !== "custom").forEach(([v, l]) => d.addOption(v, l));
        d.setValue(s.coverOverrides[id]?.paper ?? "").onChange((v) => {
          ov().paper = (v || undefined) as PaperColor | undefined;
          tidy();
        });
      });

    new Setting(contentEl)
      .setName("Shuffle")
      .setDesc("Roll a different random design in the same style.")
      .addButton((b) => b.setButtonText("Shuffle cover").onClick(() => ((s.coverSeeds[id] = (Math.random() * 0xffffffff) >>> 0), undefined)));

    new Setting(contentEl).addButton((b) => b.setButtonText("Done").setCta().onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
    this.done();
  }
}

/** Crops an image file to the cover's 3:4 shape, shrinks it, and works out the colours the rest of the book borrows from it. */
async function coverFromFile(file: File): Promise<CustomCover> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = bitmapUrl;
    });
    const W = 600;
    const H = 800;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const k = Math.max(W / img.width, H / img.height);
    const w = img.width * k;
    const h = img.height * k;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    // average colour from a tiny copy
    const tiny = document.createElement("canvas");
    tiny.width = 12;
    tiny.height = 16;
    const tc = tiny.getContext("2d");
    if (!tc) throw new Error("canvas");
    tc.drawImage(canvas, 0, 0, 12, 16);
    const px = tc.getImageData(0, 0, 12, 16).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
    }
    r /= n;
    g /= n;
    b /= n;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const rgb = (x: number, y: number, z: number) => `rgb(${Math.round(x)},${Math.round(y)},${Math.round(z)})`;
    const lightCover = lum > 0.58;
    return {
      url: canvas.toDataURL("image/jpeg", 0.86),
      base: rgb(r, g, b),
      dark: rgb(r * 0.35, g * 0.35, b * 0.35),
      light: rgb(r + (255 - r) * 0.55, g + (255 - g) * 0.55, b + (255 - b) * 0.45),
      ink: lightCover ? "#2b2140" : "#f6ecd2",
      lightCover,
    };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
