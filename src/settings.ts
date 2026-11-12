import { App, PluginSettingTab, Setting } from "obsidian";
import type FlipViewPlugin from "./main";
import { HAND_FONTS } from "./render/fonts";
import { BAND_OPTIONS, COVER_STYLE_OPTIONS, PAPER_OPTIONS, SPINE_OPTIONS } from "./modals";
import { BandStyle, CoverLabel, CoverStyle, FlipViewSettings, HandFont, PageLayout, PageTexture, PaperColor, PaperStyle, SpineStyle, TextCase } from "./types";

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
      .setName("Layout")
      .setDesc("Scene: a shelf of covers above the desk, with the notebook list and outline as slide-out drawers. Classic: sidebars on either side.")
      .addDropdown((d) =>
        d
          .addOption("scene", "Scene (shelf + desk)")
          .addOption("classic", "Classic (sidebars)")
          .setValue(s.layoutStyle)
          .onChange((v) => ((s.layoutStyle = v as "scene" | "classic"), save())),
      );
    new Setting(containerEl)
      .setName("Show the shelf of covers")
      .setDesc("Turn off to hide the shelf completely (scene layout). You can still pick notebooks from the menu, the search, or Shelf Mode.")
      .addToggle((t) => t.setValue(!s.shelfHidden).onChange((v) => ((s.shelfHidden = !v), save())));
    new Setting(containerEl)
      .setName("Side for pens and tools")
      .setDesc("Where the writing tools and highlighters sit on the desk. The legend note moves to the other side.")
      .addDropdown((d) =>
        d
          .addOption("right", "Right")
          .addOption("left", "Left")
          .setValue(s.toolsSide)
          .onChange((v) => ((s.toolsSide = v as "left" | "right"), save())),
      );
    new Setting(containerEl)
      .setName("Put short notes together")
      .setDesc("Two one-page notes in a row share a spread, instead of each leaving a blank page beside it. The second note's page is read-only for ink and highlights; open the note on its own to mark it up.")
      .addToggle((t) => t.setValue(s.packShortNotes).onChange((v) => ((s.packShortNotes = v), save())));
    new Setting(containerEl)
      .setName("Notebook tilt")
      .setDesc("How far the notebook leans back on the desk. 0 lies it flat towards you; higher looks more like it is seen from an angle.")
      .addSlider((sl) => sl.setLimits(0, 45, 1).setValue(s.bookTilt).setDynamicTooltip().onChange((v) => ((s.bookTilt = v), save())));
    new Setting(containerEl)
      .setName("Open the notebook when picked from the shelf")
      .addToggle((t) => t.setValue(s.openOnPick).onChange((v) => ((s.openOnPick = v), save())));
    new Setting(containerEl)
      .setName("Page numbers")
      .setDesc("Print a page number on each page.")
      .addToggle((t) => t.setValue(s.showPageNumbers).onChange((v) => ((s.showPageNumbers = v), save())));
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
      .setName("Desk wood")
      .setDesc("Auto uses the desk photos (lighter wood in light mode, darker wood in dark mode). The others render a wooden desk instead.")
      .addDropdown((d) =>
        d
          .addOption("auto", "Auto")
          .addOption("walnut", "Walnut")
          .addOption("oak", "Oak")
          .addOption("cherry", "Cherry")
          .addOption("teak", "Teak")
          .addOption("birch", "Birch")
          .addOption("ebony", "Ebony")
          .setValue(s.deskWood)
          .onChange((v) => ((s.deskWood = v as FlipViewSettings["deskWood"]), save())),
      );
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
          .addOption("clean", "Clean lettering")
          .addOption("plate", "Cream name plate")
          .addOption("foil", "Gold foil lettering")
          .addOption("sticker", "Paper sticker")
          .setValue(s.coverLabel)
          .onChange((v) => ((s.coverLabel = v as CoverLabel), save())),
      );
    new Setting(containerEl)
      .setName("Elastic strap")
      .setDesc("The strap that holds the notebook shut.")
      .addDropdown((d) => {
        BAND_OPTIONS.forEach(([v, l]) => d.addOption(v, l));
        d.setValue(s.bandStyle).onChange((v) => ((s.bandStyle = v as BandStyle), save()));
      })
      .addColorPicker((c) => c.setValue(s.bandColor || "#3a2f4d").onChange((v) => ((s.bandColor = v), save())))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip("Match the cover").onClick(() => ((s.bandColor = ""), save(), this.display())));
    new Setting(containerEl)
      .setName("Spine design")
      .setDesc("How spines look on the shelf, and the trim on the cover's hinge.")
      .addDropdown((d) => {
        SPINE_OPTIONS.forEach(([v, l]) => d.addOption(v, l));
        d.setValue(s.spineStyle).onChange((v) => ((s.spineStyle = v as SpineStyle), save()));
      });
    new Setting(containerEl)
      .setName("Ribbon bookmark")
      .setDesc("A ribbon hangs from the book. Click it to jump between your bookmarks.")
      .addToggle((t) => t.setValue(s.ribbon).onChange((v) => ((s.ribbon = v), save())))
      .addColorPicker((c) => c.setValue(s.ribbonColor).onChange((v) => ((s.ribbonColor = v), save())));
    new Setting(containerEl)
      .setName("Paper colour")
      .setDesc("Per-notebook paper can be set from the palette button on a notebook's cover.")
      .addDropdown((d) => {
        PAPER_OPTIONS.forEach(([v, l]) => d.addOption(v, l));
        d.setValue(s.paperColor).onChange((v) => ((s.paperColor = v as PaperColor), save()));
      })
      .addColorPicker((c) => c.setValue(s.paperCustom).onChange((v) => ((s.paperCustom = v), (s.paperColor = "custom"), save())));
    new Setting(containerEl)
      .setName("Page texture")
      .addDropdown((d) =>
        d
          .addOption("fine", "Fine grain")
          .addOption("none", "Smooth")
          .addOption("rough", "Rough")
          .addOption("laid", "Laid lines")
          .addOption("linen", "Linen weave")
          .addOption("speckled", "Recycled flecks")
          .setValue(s.pageTexture)
          .onChange((v) => ((s.pageTexture = v as PageTexture), save())),
      );
    new Setting(containerEl)
      .setName("Page layout")
      .setDesc("Realistic has a wider gutter margin, running heads and outer page numbers.")
      .addDropdown((d) =>
        d
          .addOption("realistic", "Realistic book")
          .addOption("classic", "Classic (even margins)")
          .addOption("wide", "Wide outer margin")
          .setValue(s.pageLayout)
          .onChange((v) => ((s.pageLayout = v as PageLayout), save())),
      );
    new Setting(containerEl)
      .setName("Margin notes")
      .setDesc("Shows notes in the outer margin: write “> [!margin] text” callouts in a note, or double-click a highlight to add one.")
      .addToggle((t) => t.setValue(s.marginNotes).onChange((v) => ((s.marginNotes = v), save())));
    new Setting(containerEl)
      .setName("Shelf")
      .setDesc("Start on the shelf of all your notebooks instead of the desk.")
      .addToggle((t) => t.setValue(s.shelfMode).onChange((v) => ((s.shelfMode = v), save())));
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
      .setName("Uneven line spacing")
      .setDesc("How much the spacing between lines wanders, like real handwriting. Has no effect on ruled paper, where words stay on the line.")
      .addSlider((sl) => sl.setLimits(0, 100, 5).setValue(s.lineVariance).setDynamicTooltip().onChange((v) => ((s.lineVariance = v), save())));
    new Setting(containerEl)
      .setName("Ink colour")
      .setDesc("Reset to use the theme's default ink.")
      .addColorPicker((c) => c.setValue(s.inkColor || "#2b2a4c").onChange((v) => ((s.inkColor = v), save())))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip("Reset").onClick(() => ((s.inkColor = ""), save(), this.display())));

    new Setting(containerEl).setName("Index page").setHeading();

    containerEl.createEl("p", { cls: "setting-item-description", text: "Every notebook starts with a contents page. Click an entry to jump straight to that note. Choose what it shows." });
    const idxToggle = (name: string, key: "indexEnabled" | "indexPageNumbers" | "indexLastEdited" | "indexCreated" | "indexSections" | "indexStatus" | "indexBookmarks", desc = "") =>
      new Setting(containerEl).setName(name).setDesc(desc).addToggle((t) => t.setValue(s[key]).onChange((v) => ((s[key] = v), save())));
    idxToggle("Show an index page", "indexEnabled", "Turn off to open notebooks straight to the first note.");
    new Setting(containerEl)
      .setName("Index title")
      .addText((t) => t.setPlaceholder("Contents").setValue(s.indexTitle).onChange((v) => ((s.indexTitle = v), save())));
    idxToggle("Page numbers", "indexPageNumbers", "Numbers marked ~ are estimates until every note has been laid out.");
    idxToggle("Last edited dates", "indexLastEdited");
    idxToggle("Created dates", "indexCreated");
    idxToggle("Section headings", "indexSections", "Shows your separator pages as sections.");
    idxToggle("Read status", "indexStatus", "○ unread, ● opened, ✓ finished.");
    idxToggle("Bookmark stars", "indexBookmarks");
    new Setting(containerEl)
      .setName("Dot leaders")
      .addDropdown((d) =>
        d
          .addOption("dots", "Dotted")
          .addOption("line", "Solid line")
          .addOption("none", "None")
          .setValue(s.indexLeader)
          .onChange((v) => ((s.indexLeader = v as FlipViewSettings["indexLeader"]), save())),
      );
    new Setting(containerEl)
      .setName("Date format")
      .addDropdown((d) =>
        d
          .addOption("short", "8 Nov 2026")
          .addOption("long", "Sun, 8 November 2026")
          .addOption("relative", "3 days ago")
          .setValue(s.indexDates)
          .onChange((v) => ((s.indexDates = v as FlipViewSettings["indexDates"]), save())),
      );

    new Setting(containerEl).setName("Reading progress").setHeading();

    new Setting(containerEl)
      .setName("Track reading progress")
      .setDesc("Remembers which notes you've opened in the book. Stored in the plugin's data, never in your notes.")
      .addToggle((t) => t.setValue(s.trackProgress).onChange((v) => ((s.trackProgress = v), save())));
    new Setting(containerEl)
      .setName("A note counts as read when")
      .addDropdown((d) =>
        d
          .addOption("opened", "It has been opened")
          .addOption("finished", "I've reached its last page")
          .addOption("pages", "Count pages read (partial credit)")
          .setValue(s.progressMode)
          .onChange((v) => ((s.progressMode = v as FlipViewSettings["progressMode"]), save())),
      );
    new Setting(containerEl)
      .setName("Indicator style")
      .addDropdown((d) =>
        d
          .addOption("ring", "Ring")
          .addOption("bar", "Bar")
          .addOption("count", "Count (3/5)")
          .setValue(s.progressStyle)
          .onChange((v) => ((s.progressStyle = v as FlipViewSettings["progressStyle"]), save())),
      );
    new Setting(containerEl).setName("Show on the notebook list").addToggle((t) => t.setValue(s.progressSidebar).onChange((v) => ((s.progressSidebar = v), save())));
    new Setting(containerEl).setName("Show on the cover").addToggle((t) => t.setValue(s.progressCover).onChange((v) => ((s.progressCover = v), save())));
    new Setting(containerEl).setName("Show on shelf spines").addToggle((t) => t.setValue(s.progressShelf).onChange((v) => ((s.progressShelf = v), save())));
    new Setting(containerEl)
      .setName("Recently read list")
      .setDesc("The last few notes you read, above the notebook list.")
      .addToggle((t) => t.setValue(s.showRecent).onChange((v) => ((s.showRecent = v), save())))
      .addSlider((sl) => sl.setLimits(1, 10, 1).setValue(s.recentCount).setDynamicTooltip().onChange((v) => ((s.recentCount = v), save())));
    new Setting(containerEl)
      .setName("Reset")
      .setDesc("Clear reading history, bookmarks, or everything written in the books (ink and typed text). Your notes are never touched.")
      .addButton((b) => b.setButtonText("Reading history").onClick(() => ((s.readState = {}), save())))
      .addButton((b) => b.setButtonText("Bookmarks").onClick(() => ((s.bookmarks = {}), save())))
      .addButton((b) => b.setButtonText("Ink and text").setWarning().onClick(() => ((s.annotations = {}), save())));

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
