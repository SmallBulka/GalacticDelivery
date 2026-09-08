import {
  AdvancedDynamicTexture,
  Control,
  Ellipse,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import { GuiStyles } from "./GuiStyles";

const SIZE = 132;
const ARC_SWEEP = 0.85;
const ARC_START = (Math.PI * 5) / 6;

/**
 * Индикатор заряда корабля (правый нижний угол).
 * Вынесен из speedometerEnergy — крупнее и с дугой заполнения.
 */
export class EnergyGaugeUI {
  private root!: Rectangle;
  private track!: Ellipse;
  private fillArc!: Ellipse;
  private valueLabel!: TextBlock;
  private captionLabel!: TextBlock;
  private size = SIZE;

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    const margin = GuiStyles.hud.margin;

    this.root = new Rectangle("energyGaugeRoot");
    this.root.width = `${this.size}px`;
    this.root.height = `${this.size}px`;
    this.root.thickness = 0;
    this.root.background = "transparent";
    this.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.root.left = `-${margin}px`;
    this.root.top = `-${margin}px`;
    this.root.isPointerBlocker = false;
    this.root.isHitTestVisible = false;
    this.advancedTexture.addControl(this.root);

    const glow = new Ellipse("energyGaugeGlow");
    glow.width = `${this.size}px`;
    glow.height = `${this.size}px`;
    glow.thickness = 2;
    glow.color = GuiStyles.colors.borderBright;
    glow.background = GuiStyles.colors.accentGlow;
    glow.alpha = 0.55;
    glow.isHitTestVisible = false;
    this.root.addControl(glow);

    const face = new Ellipse("energyGaugeFace");
    face.width = `${this.size - 10}px`;
    face.height = `${this.size - 10}px`;
    face.thickness = 2;
    face.color = GuiStyles.colors.border;
    face.background = GuiStyles.colors.panelBg;
    face.isHitTestVisible = false;
    this.root.addControl(face);

    this.track = new Ellipse("energyGaugeTrack");
    this.track.width = `${this.size - 28}px`;
    this.track.height = `${this.size - 28}px`;
    this.track.thickness = 7;
    this.track.color = "rgba(255, 255, 255, 0.14)";
    this.track.background = "transparent";
    this.track.rotation = ARC_START;
    this.track.arc = ARC_SWEEP;
    this.track.isHitTestVisible = false;
    face.addControl(this.track);

    this.fillArc = new Ellipse("energyGaugeFill");
    this.fillArc.width = `${this.size - 28}px`;
    this.fillArc.height = `${this.size - 28}px`;
    this.fillArc.thickness = 7;
    this.fillArc.background = "transparent";
    this.fillArc.rotation = ARC_START;
    this.fillArc.arc = 0;
    this.fillArc.isHitTestVisible = false;
    face.addControl(this.fillArc);

    this.valueLabel = new TextBlock("energyGaugeValue", "⚡ 100%");
    this.valueLabel.color = GuiStyles.colors.text;
    this.valueLabel.fontSize = 18;
    this.valueLabel.fontWeight = "700";
    this.valueLabel.height = "34px";
    this.valueLabel.top = "-8px";
    this.valueLabel.isHitTestVisible = false;
    face.addControl(this.valueLabel);

    this.captionLabel = new TextBlock("energyGaugeCaption", "ЭНЕРГИЯ");
    this.captionLabel.color = GuiStyles.colors.accentBright;
    this.captionLabel.fontSize = GuiStyles.fontSize.caption;
    this.captionLabel.fontWeight = "600";
    this.captionLabel.height = "16px";
    this.captionLabel.top = "15px";
    this.captionLabel.isHitTestVisible = false;
    face.addControl(this.captionLabel);

    this.update(100);
  }

  applyScale(scale: number): void {
    this.root.scaleX = scale;
    this.root.scaleY = scale;
  }

  update(energyPercent: number): void {
    const energy = Math.max(0, Math.min(100, Math.round(energyPercent)));
    const t = energy / 100;

    this.fillArc.arc = ARC_SWEEP * t;
    this.fillArc.color = this.energyColor(energy);
    this.fillArc.isVisible = energy > 0;

    this.valueLabel.text = `⚡ ${energy}%`;
    this.valueLabel.color = this.energyTextColor(energy);

    this.captionLabel.color =
      energy <= 0 ? GuiStyles.colors.danger : GuiStyles.colors.accentBright;
  }

  private energyTextColor(energy: number): string {
    if (energy <= 0) return GuiStyles.colors.danger;
    if (energy <= 25) return "#ffb347";
    return GuiStyles.colors.text;
  }

  private energyColor(energy: number): string {
    if (energy <= 0) return GuiStyles.colors.danger;
    if (energy <= 25) return "#ffb347";
    if (energy <= 50) return "#ffd24d";
    return GuiStyles.colors.success;
  }
}
