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
/** Старт дуги ~8 часов; положительный rotation GUI — по часовой. */
const ARC_START = (Math.PI * 5) / 6;
const DISPLAY_MAX = 650;
const NEEDLE_LEN = 62;
const GRADIENT_SEGMENTS = 24;

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
    this.setClockwiseProgress(this.progressArc, 0);
    this.face.addControl(this.progressArc);

    this.needle = new Rectangle("speedometerNeedle");
    this.needle.width = `${NEEDLE_LEN}px`;
    this.needle.height = "2px";
    this.needle.thickness = 0;
    this.needle.background = "#ffffff";
    this.needle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.needle.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.needle.transformCenterX = 0;
    this.needle.left = `${NEEDLE_LEN / 2}px`;
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

    this.energyLabel = new TextBlock("speedometerEnergy", "⚡ 100%");
    this.energyLabel.color = GuiStyles.colors.text;
    this.energyLabel.fontSize = GuiStyles.fontSize.body;
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

  /**
   * @param speed — линейная скорость из физики
   * @param maxSpeed — лимит из FlightSettings
   * @param energyPercent — заряд (пока без системы энергии — 100)
   */
  update(speed: number, maxSpeed: number, energyPercent = 100): void {
    const safeMax = Math.max(1, maxSpeed);
    const ratio = Math.max(0, Math.min(1, speed / safeMax));

    this.setClockwiseProgress(this.progressArc, ratio);
    this.progressArc.isVisible = ratio > 0.01;
    this.progressArc.color = this.speedColor(ratio);

    this.needle.rotation = ARC_START + Math.PI * 2 * ARC_SWEEP * ratio;
    this.needle.alpha = ratio > 0.02 ? 1 : 0.35;

    this.speedValue.text = String(Math.round(ratio * DISPLAY_MAX));

    const energy = Math.max(0, Math.min(100, Math.round(energyPercent)));
    this.energyLabel.text = `⚡ ${energy}%`;
    this.energyLabel.color =
      energy > 30 ? GuiStyles.colors.text : GuiStyles.colors.danger;
  }

  /** Подложка шкалы: сегменты green → yellow → red по часовой. */
  private createGradientTrack(): void {
    const step = 1 / GRADIENT_SEGMENTS;
    for (let i = 0; i < GRADIENT_SEGMENTS; i++) {
      const t0 = i * step;
      const t1 = (i + 1) * step;
      const seg = this.createArcEllipse(`speedometerGrad_${i}`);
      seg.thickness = 8;
      seg.color = this.speedColor((t0 + t1) * 0.5);
      seg.alpha = 0.3;
      // Ellipse рисует против часовой от rotation → старт в конце сегмента, дуга назад к началу.
      seg.rotation = ARC_START + Math.PI * 2 * ARC_SWEEP * t1;
      seg.arc = ARC_SWEEP * step + 0.003;
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
   * Заполнение [0…ratio] по часовой от ARC_START.
   * Ellipse.arc идёт против часовой, поэтому rotation ставится на «кончик» дуги.
   */
  private setClockwiseProgress(el: Ellipse, ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    el.arc = ARC_SWEEP * r;
    el.rotation = ARC_START + Math.PI * 2 * ARC_SWEEP * r;
  }

  /** Зелёный (медленно) → жёлтый → красный (быстро). */
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
