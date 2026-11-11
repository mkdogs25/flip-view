import { Platform } from "obsidian";
import { iconButton } from "./dom";

interface WebviewEl extends HTMLElement {
  reload(): void;
  goBack(): void;
  canGoBack(): boolean;
}

/**
 * A laptop on the desk that opens external links. On desktop Obsidian it hosts an Electron <webview>
 * (isolated session); elsewhere it falls back to a sandboxed iframe. Sites that refuse to be embedded
 * can still be opened in the real browser from the laptop's toolbar.
 */
export class Laptop {
  readonly el: HTMLElement;
  private urlEl: HTMLElement;
  private viewBox: HTMLElement;
  private fallback: HTMLElement;
  private fallbackMsg: HTMLElement;
  private btnBack: HTMLButtonElement;
  private view: HTMLElement | null = null;
  private url = "";
  private opened = false;
  private unmountTimer = 0;

  constructor(parent: HTMLElement, private cb: { close(): void; openExternal(url: string): void }) {
    this.el = parent.createDiv({ cls: "fv-laptop", attr: { "aria-hidden": "true" } });
    const rig = this.el.createDiv({ cls: "fv-laptop-rig" });
    rig.createDiv({ cls: "fv-laptop-shadow" });
    const lid = rig.createDiv({ cls: "fv-laptop-lid" });
    const screen = lid.createDiv({ cls: "fv-laptop-screen" });
    const bar = screen.createDiv({ cls: "fv-laptop-bar" });
    const dots = bar.createDiv({ cls: "fv-laptop-dots" });
    dots.createSpan();
    dots.createSpan();
    dots.createSpan();
    this.btnBack = iconButton(bar, "chevron-left", "Back", "fv-lap-btn");
    this.btnBack.addEventListener("click", () => this.back());
    iconButton(bar, "refresh-cw", "Reload", "fv-lap-btn").addEventListener("click", () => this.reload());
    this.urlEl = bar.createDiv({ cls: "fv-laptop-url" });
    iconButton(bar, "external-link", "Open in your browser", "fv-lap-btn").addEventListener("click", () => this.url && this.cb.openExternal(this.url));
    iconButton(bar, "x", "Close the laptop", "fv-lap-btn").addEventListener("click", () => this.cb.close());
    this.viewBox = screen.createDiv({ cls: "fv-laptop-view" });
    this.fallback = screen.createDiv({ cls: "fv-laptop-fallback" });
    this.fallbackMsg = this.fallback.createDiv({ cls: "fv-laptop-fallback-msg" });
    const open = this.fallback.createEl("button", { cls: "mod-cta", text: "Open in your browser", attr: { type: "button" } });
    open.addEventListener("click", () => this.url && this.cb.openExternal(this.url));
    lid.createDiv({ cls: "fv-laptop-cam" });
    const deck = rig.createDiv({ cls: "fv-laptop-deck" });
    deck.createDiv({ cls: "fv-laptop-keys" });
    deck.createDiv({ cls: "fv-laptop-pad" });
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(url: string): void {
    window.clearTimeout(this.unmountTimer);
    this.url = url;
    this.opened = true;
    this.el.addClass("is-open");
    this.el.setAttr("aria-hidden", "false");
    this.showUrl(url);
    this.mount(url);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.el.removeClass("is-open");
    this.el.setAttr("aria-hidden", "true");
    // stop the page once the lid has shut
    this.unmountTimer = window.setTimeout(() => this.unmount(), 1100);
  }

  destroy(): void {
    window.clearTimeout(this.unmountTimer);
    this.unmount();
    this.el.remove();
  }

  /* ----------------------------------------------------------------- */

  private showUrl(url: string): void {
    try {
      const u = new URL(url);
      this.urlEl.setText(u.host + (u.pathname === "/" ? "" : u.pathname) + u.search);
    } catch {
      this.urlEl.setText(url);
    }
    this.urlEl.setAttr("title", url);
  }

  private unmount(): void {
    this.view?.remove();
    this.view = null;
    this.viewBox.empty();
  }

  private showFail(msg: string): void {
    this.fallbackMsg.setText(`This page can't be shown here${msg ? ` (${msg})` : ""}. Some sites don't allow embedding.`);
    this.fallback.addClass("is-visible");
  }

  private mount(url: string): void {
    this.unmount();
    this.fallback.removeClass("is-visible");
    let view: HTMLElement | null = null;
    if (Platform.isDesktopApp) {
      const wv = document.createElement("webview") as WebviewEl;
      wv.setAttribute("partition", "flip-view-laptop");
      wv.setAttribute("src", url);
      this.viewBox.appendChild(wv);
      if (typeof wv.reload === "function") {
        const on = (name: string, fn: (e: Event & Record<string, unknown>) => void) => wv.addEventListener(name, fn as EventListener);
        on("did-fail-load", (e) => {
          if (e.errorCode === -3 || e.isMainFrame === false) return; // aborted / sub-frame
          this.showFail(String(e.errorDescription ?? ""));
        });
        const nav = (e: Event & Record<string, unknown>) => {
          if (typeof e.url === "string") {
            this.url = e.url;
            this.showUrl(e.url);
          }
          this.btnBack.disabled = !wv.canGoBack();
        };
        on("did-navigate", nav);
        on("did-navigate-in-page", nav);
        on("new-window", (e) => {
          e.preventDefault?.();
          if (typeof e.url === "string") this.cb.openExternal(e.url);
        });
        view = wv;
      } else {
        wv.remove();
      }
    }
    if (!view) {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("title", "Linked page");
      frame.src = url;
      this.viewBox.appendChild(frame);
      this.btnBack.disabled = true;
      view = frame;
    }
    this.view = view;
  }

  private back(): void {
    const wv = this.view as WebviewEl | null;
    if (wv && typeof wv.goBack === "function" && wv.canGoBack()) wv.goBack();
  }

  private reload(): void {
    this.fallback.removeClass("is-visible");
    const v = this.view as WebviewEl | HTMLIFrameElement | null;
    if (!v) return;
    if ("reload" in v && typeof v.reload === "function") v.reload();
    else (v as HTMLIFrameElement).src = this.url;
  }
}
