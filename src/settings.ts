import { App, PluginSettingTab, Setting } from "obsidian";
import type FlipViewPlugin from "./main";
import { HAND_FONTS } from "./render/fonts";
import { COVER_STYLE_OPTIONS } from "./modals";
import { CoverLabel, CoverStyle, FlipViewSettings, HandFont, PaperStyle, TextCase } from "./types";

export class FlipViewSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: FlipViewPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();
    const save = () => void this.plugin.saveSettings();

    new Setting(containerEl).setName("Grouping").setHeading();

    new Setting(containerEl)
      .setName("Group notes into notebooks by")
      .setDesc("A folder: every folder becomes a notebook. A property: notes that share a property value are grouped together.")
      .addDropdown((d) =>
        d
          .addOption("folder", "Folder")
          .addOption("property", "Property")
          .setValue(s.groupBy)
          .onChange((v) => {
            s.groupBy = v as FlipViewSettings["groupBy"];
            save();
            this.display();
          }),
      );

    if (s.groupBy === "folder") {
      new Setting(containerEl)
        .setName("Start from folder")
        .setDesc("Only look inside this folder. Leave empty for the whole vault.")
        .addText((t) => t.setPlaceholder("(whole vault)").setValue(s.rootFolder).onChange((v) => ((s.rootFolder = v), save())));
      new Setting(containerEl)
        .setName("Which folders are notebooks")
        .setDesc("Top-level folders include everything beneath them. Every folder makes each folder with notes its own notebook.")
        .addDropdown((d) =>
          d
            .addOption("top", "Top-level folders")
            .addOption("all", "Every folder")
            .setValue(s.folderScope)
            .onChange((v) => ((s.folderScope = v as "top" | "all"), save())),
        );
      new Setting(containerEl)
        .setName("Excluded folders")
        .setDesc("One folder path per line (or comma separated).")
        .addTextArea((t) => t.setValue(s.excludedFolders).onChange((v) => ((s.excludedFolders = v), save())));
    } else {
      new Setting(containerEl)
        .setName("Property name")
        .setDesc("Notes with the same value for this property form a notebook. Lists put a note in several notebooks. Use “tags” to group by tag.")
        .addText((t) => t.setPlaceholder("notebook").setValue(s.propertyName).onChange((v) => ((s.propertyName = v.trim()), save())));
    }

    new Setting(containerEl)
      .setName(s.groupBy === "folder" ? "Include notes outside any folder" : "Include notes without the property")
      .setDesc(s.groupBy === "folder" ? "Adds a notebook for loose notes at the top level." : "Adds an “Unfiled” notebook.")
      .addToggle((t) => t.setValue(s.includeUnfiled).onChange((v) => ((s.includeUnfiled = v), save())));

    new Setting(containerEl)
      .setName("Order of notes in a notebook")
      .addDropdown((d) =>
        d
          .addOption("name-asc", "Name (A–Z)")
          .addOption("name-desc", "Name (Z–A)")
          .addOption("modified-desc", "Recently edited first")
          .addOption("modified-asc", "Least recently edited first")
          .addOption("created-asc", "Oldest created first")
          .addOption("created-desc", "Newest created first")
          .setValue(s.noteSort)
          .onChange((v) => ((s.noteSort = v as FlipViewSettings["noteSort"]), save())),
      );
    new Setting(containerEl)
      .setName("Order of notebooks")
      .addDropdown((d) =>
        d
          .addOption("name", "Name")
          .addOption("recent", "Recently edited")
          .addOption("count", "Number of notes")
          .setValue(s.notebookSort)
          .onChange((v) => ((s.notebookSort = v as FlipViewSettings["notebookSort"]), save())),
      );

    new Setting(containerEl).setName("Look").setHeading();

    new Setting(containerEl)
      .setName("Colour mode")
      .setDesc("Auto follows Obsidian's light or dark theme.")
      .addDropdown((d) =>
        d
          .addOption("auto", "Auto")
          .addOption("light", "Light desk")
          .addOption("dark", "Dark desk")
          .setValue(s.theme)
          .onChange((v) => ((s.theme = v as FlipViewSettings["theme"]), save())),
      );
    new Setting(containerEl)
      .setName("Show the desk")
      .setDesc("The wooden desk behind the notebook. Turn off for a plain background.")
      .addToggle((t) => t.setValue(s.showDesk).onChange((v) => ((s.showDesk = v), save())));
    new Setting(containerEl)
      .setName("Cover design")
      .setDesc("Covers are generated randomly from each notebook's name, with no AI. Pick one style or let each notebook get its own. You can also change a single notebook's cover with the palette button on its closed cover.")
      .addDropdown((d) => {
        COVER_STYLE_OPTIONS.forEach(([v, l]) => d.addOption(v, v === "random" ? "Random per notebook" : l));
        d.setValue(s.coverStyle).onChange((v) => ((s.coverStyle = v as CoverStyle), save()));
      })
      .addExtraButton((b) =>
        b
          .setIcon("dices")
          .setTooltip("Reroll every cover")
          .onClick(() => {
            s.coverSeeds = {};
            s.coverSalt = Date.now();
            save();
          }),
      );
    new Setting(containerEl)
      .setName("Cover colour")
      .setDesc("Tints every cover. Reset to let each notebook pick its own colours.")
      .addColorPicker((c) => c.setValue(s.coverColor || "#7c5cbf").onChange((v) => ((s.coverColor = v), save())))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip("Reset").onClick(() => ((s.coverColor = ""), save(), this.display())));
    new Setting(containerEl)
      .setName("Cover label")
      .addDropdown((d) =>
        d
          .addOption("plate", "Cream name plate")
          .addOption("foil", "Gold foil lettering")
          .addOption("sticker", "Paper sticker")
          .setValue(s.coverLabel)
          .onChange((v) => ((s.coverLabel = v as CoverLabel), save())),
      );
    new Setting(containerEl)
      .setName("Elastic band")
      .setDesc("The strap on the right of the cover.")
      .addToggle((t) => t.setValue(s.coverBand).onChange((v) => ((s.coverBand = v), save())));
    new Setting(containerEl)
      .setName("Paper")
      .setDesc("Page style for handwritten view.")
      .addDropdown((d) =>
        d
          .addOption("plain", "Plain")
          .addOption("lined", "Lined")
          .addOption("grid", "Grid")
          .addOption("dotted", "Dotted")
          .setValue(s.paperStyle)
          .onChange((v) => ((s.paperStyle = v as PaperStyle), save())),
      );
    new Setting(containerEl)
      .setName("Turning pages")
      .setDesc("Click a page to flip it, pull a page corner to flip it like a real page, or only use the navigation bar under the book. Arrow keys always work.")
      .addDropdown((d) =>
        d
          .addOption("click", "Click a page")
          .addOption("drag", "Pull the page corner")
          .addOption("nav", "Navigation bar only")
          .setValue(s.flipMode)
          .onChange((v) => ((s.flipMode = v as FlipViewSettings["flipMode"]), save())),
      );
    new Setting(containerEl)
      .setName("Animation")
      .addDropdown((d) =>
        d
          .addOption("full", "Full")
          .addOption("fast", "Fast")
          .addOption("off", "Off")
          .setValue(s.animation)
          .onChange((v) => ((s.animation = v as FlipViewSettings["animation"]), save())),
      );
    new Setting(containerEl)
      .setName("Show note title on the first page")
      .setDesc("Adds the file name as a heading when a note doesn't start with one.")
      .addToggle((t) => t.setValue(s.showNoteTitle).onChange((v) => ((s.showNoteTitle = v), save())));
    new Setting(containerEl)
      .setName("Show “last edited” badge")
      .addToggle((t) => t.setValue(s.showLastEdited).onChange((v) => ((s.showLastEdited = v), save())));
    new Setting(containerEl)
      .setName("Accent colour")
      .setDesc("Headings, bullets and highlights. Reset to follow your Obsidian accent colour.")
      .addColorPicker((c) => c.setValue(s.accentColor || "#7c5cbf").onChange((v) => ((s.accentColor = v), save())))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip("Reset").onClick(() => ((s.accentColor = ""), save(), this.display())));

    new Setting(containerEl).setName("Handwritten view").setHeading();

    new Setting(containerEl)
      .setName("Handwriting")
      .setDesc("Includes joined-up cursive options (Alex Brush is the loopy brush script). Maths and code are written out in the same hand.")
      .addDropdown((d) => {
        HAND_FONTS.forEach((f) => d.addOption(f.id, f.label));
        d.setValue(s.handFont).onChange((v) => ((s.handFont = v as HandFont), save()));
      });
    new Setting(containerEl)
      .setName("Heading handwriting")
      .setDesc("Headings can use a different hand from the body text.")
      .addDropdown((d) => {
        d.addOption("same", "Same as body");
        HAND_FONTS.forEach((f) => d.addOption(f.id, f.label));
        d.setValue(s.headingFont).onChange((v) => ((s.headingFont = v as HandFont | "same"), save()));
      });
    const caseOptions = (d: import("obsidian").DropdownComponent) =>
      d.addOption("smallcaps", "Small caps").addOption("normal", "Normal").addOption("uppercase", "UPPERCASE");
    new Setting(containerEl)
      .setName("Heading case")
      .setDesc("Small caps by default. Cursive heading fonts stay in normal case, since small caps hurt legibility on script.")
      .addDropdown((d) => caseOptions(d).setValue(s.headingCase).onChange((v) => ((s.headingCase = v as TextCase), save())));
    new Setting(containerEl)
      .setName("Body text case")
      .addDropdown((d) => caseOptions(d).setValue(s.bodyCase).onChange((v) => ((s.bodyCase = v as TextCase), save())));
    new Setting(containerEl)
      .setName("Handwriting size")
      .addSlider((sl) => sl.setLimits(70, 150, 5).setValue(s.handSize).setDynamicTooltip().onChange((v) => ((s.handSize = v), save())));
    new Setting(containerEl)
      .setName("Messiness")
      .setDesc("0 is neat and even. Higher values make words wobble, tilt and drift off the line.")
      .addSlider((sl) => sl.setLimits(0, 100, 5).setValue(s.messiness).setDynamicTooltip().onChange((v) => ((s.messiness = v), save())));
    new Setting(containerEl)
      .setName("Ink colour")
      .setDesc("Reset to use the theme's default ink.")
      .addColorPicker((c) => c.setValue(s.inkColor || "#2b2a4c").onChange((v) => ((s.inkColor = v), save())))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip("Reset").onClick(() => ((s.inkColor = ""), save(), this.display())));

    new Setting(containerEl).setName("Highlighters").setHeading();

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Highlighters sit on the desk. Click one, then drag over text in an open notebook to highlight it. Click a highlight with the pen active to remove it.",
    });
    s.highlighters.forEach((hl, i) => {
      new Setting(containerEl)
        .setName(`Highlighter ${i + 1}`)
        .addColorPicker((c) => c.setValue(hl.color).onChange((v) => ((hl.color = v), save())))
        .addText((t) => t.setPlaceholder("What it means").setValue(hl.label).onChange((v) => ((hl.label = v), save())))
        .addExtraButton((b) =>
          b
            .setIcon("trash-2")
            .setTooltip("Remove")
            .onClick(() => {
              s.highlighters.splice(i, 1);
              save();
              this.display();
            }),
        );
    });
    new Setting(containerEl).addButton((b) =>
      b
        .setButtonText("Add highlighter")
        .setDisabled(s.highlighters.length >= 8)
        .onClick(() => {
          const spare = ["#ffb86b", "#c9a7ff", "#7fe0d0", "#ff8a80"];
          s.highlighters.push({ color: spare[s.highlighters.length % spare.length], label: "" });
          save();
          this.display();
        }),
    );
    new Setting(containerEl)
      .setName("Show legend on the desk")
      .setDesc("A sticky note listing what each colour means. Drag it wherever you like.")
      .addToggle((t) => t.setValue(s.showLegend).onChange((v) => ((s.showLegend = v), save())))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip("Reset position").onClick(() => ((s.legendPos = null), save())));

    new Setting(containerEl).setName("Sound").setHeading();

    new Setting(containerEl)
      .setName("Sound effects")
      .setDesc("Paper and cover sounds when flipping, plus pen clicks and marker squeaks when highlighting.")
      .addToggle((t) => t.setValue(s.soundEnabled).onChange((v) => ((s.soundEnabled = v), save())));
    new Setting(containerEl)
      .setName("Volume")
      .addSlider((sl) => sl.setLimits(0, 100, 5).setValue(s.soundVolume).setDynamicTooltip().onChange((v) => ((s.soundVolume = v), save())));

    new Setting(containerEl).setName("Text view").setHeading();

    new Setting(containerEl)
      .setName("Font")
      .setDesc("Leave empty to use the font you've chosen for Obsidian's notes (including from themes and snippets).")
      .addText((t) => t.setPlaceholder("Same as Obsidian").setValue(s.textFont).onChange((v) => ((s.textFont = v), save())));
    new Setting(containerEl)
      .setName("Text size")
      .addSlider((sl) => sl.setLimits(70, 150, 5).setValue(s.textSize).setDynamicTooltip().onChange((v) => ((s.textSize = v), save())));
  }
}
