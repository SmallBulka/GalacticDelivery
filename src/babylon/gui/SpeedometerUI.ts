import {
  AdvancedDynamicTexture,
  Control,
  Ellipse,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import { GuiStyles } from "./GuiStyles";

const SIZE = 168;
const ARC_SWEEP = 0.72;
/** Старт шкалы ~8 часов; положительный rotation GUI — по часовой. */
const ARC_START = (Math.PI * 5) / 6;
const ARC_RADIUS = (SIZE - 28) / 2;
const GRADIENT_SEGMENTS = 10;

/**
 * Доля шкалы [0…1], совпадающая с rotation сегмента speedometerGrad_i
 * (у сегмента i rotation = tipAngle((i + 1) / N)).
 */
const NEEDLE_T_IDLE = 1 / GRADIENT_SEGMENTS; // speedometerGrad_0
const NEEDLE_T_MAX = 9 / GRADIENT_SEGMENTS; // граница grad_8 / grad_9

/**
 * Круглый спидометр скорости корабля (левый нижний угол).
 */
export class SpeedometerUI {
  private root!: Rectangle;
  private face!: Ellipse;
  private progressArc!: Ellipse;
  private needle!: Rectangle;
  private speedValue!: TextBlock;
  private unitLabel!: TextBlock;
  private energyLabel!: TextBlock;
  private size = SIZE;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.root = new Rectangle("speedometerRoot");
    this.root.width = `${this.size}px`;
    this.root.height = `${this.size}px`;
    this.root.thickness = 0;
    this.root.background = "transparent";
    this.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.root.left = `${GuiStyles.hud.margin}px`;
    this.root.top = `-${GuiStyles.hud.margin}px`;
    this.root.isPointerBlocker = false;
    this.root.isHitTestVisible = false;
    this.advancedTexture.addControl(this.root);

    const outerGlow = new Ellipse("speedometerGlow");
    outerGlow.width = `${this.size}px`;
    outerGlow.height = `${this.size}px`;
    outerGlow.thickness = 2;
    outerGlow.color = GuiStyles.colors.borderBright;
    outerGlow.background = GuiStyles.colors.accentGlow;
    outerGlow.isHitTestVisible = false;
    this.root.addControl(outerGlow);

    this.face = new Ellipse("speedometerFace");
    this.face.width = `${this.size - 8}px`;
    this.face.height = `${this.size - 8}px`;
    this.face.thickness = 2;
    this.face.color = GuiStyles.colors.border;
    this.face.background = GuiStyles.colors.panelBg;
    this.face.isHitTestVisible = false;
    this.root.addControl(this.face);

    this.createGradientTrack();

    this.progressArc = this.createArcEllipse("speedometerArc");
    this.progressArc.thickness = 9;
    this.progressArc.color = this.speedColor(0);
    this.setProgress(this.progressArc, NEEDLE_T_IDLE);
    this.face.addControl(this.progressArc);

    this.needle = new Rectangle("speedometerNeedle");
    this.needle.width = `${ARC_RADIUS}px`;
    this.needle.height = "2px";
    this.needle.thickness = 0;
    this.needle.background = "#ffffff";
    this.needle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.needle.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.needle.transformCenterX = 0;
    this.needle.left = `${ARC_RADIUS / 2}px`;
    this.needle.isHitTestVisible = false;
    this.face.addControl(this.needle);

    const hub = new Ellipse("speedometerHub");
    hub.width = "8px";
    hub.height = "8px";
    hub.thickness = 0;
    hub.background = "#ffffff";
    hub.isHitTestVisible = false;
    this.face.addControl(hub);

    this.speedValue = new TextBlock("speedometerValue", "0");
    this.speedValue.color = GuiStyles.colors.text;
    this.speedValue.fontSize = 36;
    this.speedValue.fontWeight = "700";
    this.speedValue.height = "42px";
    this.speedValue.top = "-8px";
    this.speedValue.isHitTestVisible = false;
    this.face.addControl(this.speedValue);

    const divider = new Rectangle("speedometerDivider");
    divider.width = "48px";
    divider.height = "1px";
    divider.thickness = 0;
    divider.background = "rgba(232, 244, 255, 0.55)";
    divider.top = "18px";
    divider.isHitTestVisible = false;
    this.face.addControl(divider);

    this.unitLabel = new TextBlock("speedometerUnit", "КМ/Ч");
    this.unitLabel.color = GuiStyles.colors.accentBright;
    this.unitLabel.fontSize = GuiStyles.fontSize.caption;
    this.unitLabel.fontWeight = "600";
    this.unitLabel.height = "16px";
    this.unitLabel.top = "28px";
    this.unitLabel.isHitTestVisible = false;
    this.face.addControl(this.unitLabel);

    this.energyLabel = new TextBlock("speedometerEnergy");
    this.energyLabel.color = GuiStyles.colors.text;
    this.energyLabel.fontSize = GuiStyles.fontSize.caption;
    this.energyLabel.fontWeight = "600";
    this.energyLabel.height = "20px";
    this.energyLabel.top = "52px";
    this.energyLabel.isHitTestVisible = false;
    this.face.addControl(this.energyLabel);

    this.update(0, 100);
  }

  applyScale(scale: number): void {
    this.root.scaleX = scale;
    this.root.scaleY = scale;
  }

  update(speed: number, maxSpeed: number, energyPercent = 100, crates = 0): void {
    const safeMax = Math.max(1, maxSpeed);
    const ratio = Math.max(0, Math.min(1, speed / safeMax));

    // Стрелка: покой → grad_0, макс. скорость → grad_8 / grad_9.
    const needleT =
      NEEDLE_T_IDLE + ratio * (NEEDLE_T_MAX - NEEDLE_T_IDLE);

    this.setProgress(this.progressArc, needleT);
    this.progressArc.isVisible = ratio > 0.01;
    this.progressArc.color = this.speedColor(ratio);

    this.needle.rotation = this.tipAngle(needleT);
    this.needle.alpha = ratio > 0.02 ? 1 : 0.35;

    this.speedValue.text = String(Math.round(speed));

    const energy = Math.max(0, Math.min(100, Math.round(energyPercent)));
    this.energyLabel.text = `⚡ ${energy}% `;
    this.energyLabel.color =
      energy > 30 ? GuiStyles.colors.text : GuiStyles.colors.danger;
  }

  /** Угол на шкале при доле t ∈ [0…1] (как у сегментов градиента). */
  private tipAngle(t: number): number {
    return ARC_START + Math.PI * 2 * ARC_SWEEP * Math.max(0, Math.min(1, t));
  }

  private createGradientTrack(): void {
    const step = 1 / GRADIENT_SEGMENTS;
    for (let i = 0; i < GRADIENT_SEGMENTS; i++) {
      const t0 = i * step;
      const t1 = (i + 1) * step;
      const seg = this.createArcEllipse(`speedometerGrad_${i}`);
      seg.thickness = 8;
      seg.color = this.speedColor((t0 + t1) * 0.5);
      seg.alpha = 0.45;
      // rotation сегмента i = tipAngle((i+1)/N) — на него садится стрелка.
      seg.rotation = this.tipAngle(t1);
      seg.arc = ARC_SWEEP * step + 0.004;
      this.face.addControl(seg);
    }
  }

  private createArcEllipse(name: string): Ellipse {
    const el = new Ellipse(name);
    el.width = `${this.size - 28}px`;
    el.height = `${this.size - 28}px`;
    el.background = "transparent";
    el.isHitTestVisible = false;
    return el;
  }

  /**
   * Дуга до доли t: Ellipse.arc против часовой от rotation,
   * поэтому rotation = начало дуги = кончик стрелки.
   */
  private setProgress(el: Ellipse, t: number): void {
    const clamped = Math.max(0, Math.min(1, t));
    el.arc = ARC_SWEEP * clamped;
    el.rotation = this.tipAngle(clamped);
  }

  private speedColor(t: number): string {
    const clamped = Math.max(0, Math.min(1, t));
    if (clamped < 0.5) {
      return this.lerpRgb(
        { r: 93, g: 255, b: 176 },
        { r: 255, g: 210, b: 77 },
        clamped / 0.5
      );
    }
    return this.lerpRgb(
      { r: 255, g: 210, b: 77 },
      { r: 255, g: 92, b: 108 },
      (clamped - 0.5) / 0.5
    );
  }

  private lerpRgb(
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
    t: number
  ): string {
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }
}
