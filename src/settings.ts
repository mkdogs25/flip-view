import { App, PluginSettingTab, Setting } from "obsidian";
import type FlipViewPlugin from "./main";
import { HAND_FONTS } from "./render/fonts";
import { CoverStyle, FlipViewSettings, PaperStyle } from "./types";

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
      .setDesc("Covers are generated randomly from each notebook's name, with no AI. Pick one style or let each notebook get its own. Use the dice button on a closed notebook to reroll it.")
      .addDropdown((d) =>
        d
          .addOption("random", "Random per notebook")
          .addOption("cosmic", "Cosmic")
          .addOption("leather", "Leather")
          .addOption("linen", "Linen")
          .addOption("marble", "Marble")
          .addOption("geometric", "Geometric")
          .setValue(s.coverStyle)
          .onChange((v) => ((s.coverStyle = v as CoverStyle), save())),
      )
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
      .addDropdown((d) => {
        HAND_FONTS.forEach((f) => d.addOption(f.id, f.label));
        d.setValue(s.handFont).onChange((v) => ((s.handFont = v as FlipViewSettings["handFont"]), save()));
      });
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
