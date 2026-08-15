import type { ILoadingScreen } from "@babylonjs/core/Loading/loadingScreen";

/**
 * Кастомный загрузочный экран Babylon.js с текстовым статусом текущего этапа.
 * @see https://doc.babylonjs.com/features/featuresDeepDive/scene/customLoadingScreen
 */
export class StatusLoadingScreen implements ILoadingScreen {
  private _loadingUIText = "Загрузка...";
  private _loadingUIBackgroundColor = "#0a0e17";
  private overlay: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private visible = false;

  get loadingUIText(): string {
    return this._loadingUIText;
  }

  set loadingUIText(text: string) {
    this._loadingUIText = text;
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }

  get loadingUIBackgroundColor(): string {
    return this._loadingUIBackgroundColor;
  }

  set loadingUIBackgroundColor(color: string) {
    this._loadingUIBackgroundColor = color;
    if (this.overlay) {
      this.overlay.style.background = color;
    }
  }

  setStatus(text: string): void {
    this.loadingUIText = text;
  }

  displayLoadingUI(): void {
    if (this.visible) {
      return;
    }
    this.visible = true;

    const overlay = document.createElement("div");
    overlay.id = "galactic-loading-screen";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:9999",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      `background:${this._loadingUIBackgroundColor}`,
      "color:#e8eef7",
      "font-family:Segoe UI,system-ui,sans-serif",
      "gap:16px",
      "user-select:none",
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "Galactic Delivery";
    title.style.cssText =
      "font-size:28px;font-weight:600;letter-spacing:0.04em;";

    const status = document.createElement("div");
    status.textContent = this._loadingUIText;
    status.style.cssText =
      "font-size:16px;opacity:0.9;min-height:1.4em;text-align:center;padding:0 24px;";

    const hint = document.createElement("div");
    hint.textContent = "Подождите, идёт подготовка мира";
    hint.style.cssText = "font-size:13px;opacity:0.55;margin-top:8px;";

    overlay.appendChild(title);
    overlay.appendChild(status);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.statusEl = status;
  }

  hideLoadingUI(): void {
    this.visible = false;
    if (this.overlay?.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
    this.overlay = null;
    this.statusEl = null;
  }
}
