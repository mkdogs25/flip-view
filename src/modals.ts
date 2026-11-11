import { App, Modal, Setting } from "obsidian";

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
      "Pick a notebook on the left, then click its cover to flip it open.",
      "Turn pages with the arrow keys, the page edges, or the arrows under the book. Turning back past the first page closes the notebook.",
      "Switch between Handwritten and Text at the top. Text uses your own note font; handwriting is generated from the same text.",
      "The list button under the book jumps to any note. The page icon opens the note itself.",
      "Click the dice on a closed notebook to shuffle its cover. Covers are generated randomly per notebook, with no AI involved.",
      "In settings you can group notes by folder or by a property, and tune handwriting font, size and messiness.",
    ].forEach((t) => ul.createEl("li", { text: t }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
