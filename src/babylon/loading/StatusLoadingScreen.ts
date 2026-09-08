import type { ILoadingScreen } from "@babylonjs/core/Loading/loadingScreen";

const LOADING_TIPS = [
  "Энергия тратится в полёте — следите за зарядом на спидометре.",
  "Светящиеся банки рядом с кораблём пополняют энергию на 10%.",
  "Летите к планетам с цветной атмосферой и кольцом — там задания.",
  "Маркер над кораблём указывает направление к цели квеста.",
  "Клавиша 1 — камера от первого лица, 2 — от третьего.",
  "R — перезапуск позиции и заряда, если энергия на нуле.",
  "Откройте «?» после загрузки — полное управление и подсказки.",
];

/**
 * Кастомный загрузочный экран Babylon.js со статусом этапа и советами новичкам.
 */
export class StatusLoadingScreen implements ILoadingScreen {
  private _loadingUIText = "Загрузка...";
  private _loadingUIBackgroundColor = "#0a0e17";
  private overlay: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private tipEl: HTMLDivElement | null = null;
  private visible = false;
  private tipIndex = 0;
  private tipTimer: ReturnType<typeof setInterval> | null = null;

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
      "gap:14px",
      "user-select:none",
      "padding:24px",
      "box-sizing:border-box",
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "Galactic Delivery";
    title.style.cssText =
      "font-size:28px;font-weight:600;letter-spacing:0.04em;";

    const status = document.createElement("div");
    status.textContent = this._loadingUIText;
    status.style.cssText =
      "font-size:16px;opacity:0.9;min-height:1.4em;text-align:center;max-width:520px;";

    const tipLabel = document.createElement("div");
    tipLabel.textContent = "Совет";
    tipLabel.style.cssText =
      "font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.45;margin-top:20px;";

    const tip = document.createElement("div");
    tip.style.cssText = [
      "font-size:14px",
      "opacity:0.78",
      "text-align:center",
      "max-width:460px",
      "line-height:1.45",
      "min-height:2.9em",
      "transition:opacity 0.25s ease",
    ].join(";");

    overlay.appendChild(title);
    overlay.appendChild(status);
    overlay.appendChild(tipLabel);
    overlay.appendChild(tip);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.statusEl = status;
    this.tipEl = tip;
    this.tipIndex = Math.floor(Math.random() * LOADING_TIPS.length);
    this.showCurrentTip();
    this.tipTimer = setInterval(() => this.rotateTip(), 4500);
  }

  hideLoadingUI(): void {
    this.visible = false;
    if (this.tipTimer) {
      clearInterval(this.tipTimer);
      this.tipTimer = null;
    }
    if (this.overlay?.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
    this.overlay = null;
    this.statusEl = null;
    this.tipEl = null;
  }

  private showCurrentTip(): void {
    if (!this.tipEl) return;
    this.tipEl.textContent = LOADING_TIPS[this.tipIndex % LOADING_TIPS.length];
  }

  private rotateTip(): void {
    if (!this.tipEl) return;
    this.tipEl.style.opacity = "0";
    window.setTimeout(() => {
      if (!this.tipEl) return;
      this.tipIndex = (this.tipIndex + 1) % LOADING_TIPS.length;
      this.showCurrentTip();
      this.tipEl.style.opacity = "0.78";
    }, 220);
  }
}
