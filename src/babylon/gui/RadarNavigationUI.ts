import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { Matrix, Vector3 } from "@babylonjs/core";
import { GuiStyles } from "./GuiStyles";
import { createGlassPanel, createVerticalStack, styleSectionHeader } from "./GuiHelpers";

const RADAR_RANGE = 4800;
const MAX_BLIPS = 6;

export interface RadarBlipData {
  worldPos: Vector3;
  color: string;
  label: string;
  primary?: boolean;
  dimmed?: boolean;
}

/**
 * Круглый радар: мини-карта и навигация к целям активного квеста.
 */
export class RadarNavigationUI {
  private root!: StackPanel;
  private radarWrapper!: Rectangle;
  private face!: Rectangle;
  private infoPanel!: Rectangle;
  private bearingLine!: Rectangle;
  private primaryHalo!: Rectangle;
  private blipPool: Rectangle[] = [];
  private shipMarker!: TextBlock;
  private hintLabel!: TextBlock;
  private targetLabel!: TextBlock;
  private distanceLabel!: TextBlock;
  private rangeLabel!: TextBlock;

  private radarSize = GuiStyles.hud.radarSize;
  private radarRadiusPx = 84;

  private primaryTarget: Vector3 | null = null;
  private primaryName = "";
  private flightHint = "";
  private blips: RadarBlipData[] = [];
  private elapsed = 0;

  private readonly scratchForward = new Vector3();
  private readonly scratchRight = new Vector3();
  private readonly scratchUp = new Vector3();
  private readonly scratchTo = new Vector3();

  constructor(private advancedTexture: AdvancedDynamicTexture) {}

  initialize(): void {
    this.root = createVerticalStack("radarRoot", GuiStyles.spacing.sm);
    this.root.width = `${this.radarSize + 20}px`;
    this.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.root.top = `${GuiStyles.hud.margin}px`;
    this.root.isPointerBlocker = false;
    this.root.isHitTestVisible = false;
    this.advancedTexture.addControl(this.root);

    this.radarWrapper = new Rectangle("radarWrapper");
    this.radarWrapper.width = `${this.radarSize + 12}px`;
    this.radarWrapper.height = `${this.radarSize + 12}px`;
    this.radarWrapper.thickness = 0;
    this.radarWrapper.background = "transparent";
    this.root.addControl(this.radarWrapper);

    const outerGlow = this.createCircle("radarOuterGlow", this.radarSize + 4, 2);
    outerGlow.color = GuiStyles.colors.borderBright;
    outerGlow.background = GuiStyles.colors.accentGlow;
    this.radarWrapper.addControl(outerGlow);

    this.face = this.createCircle("radarFace", this.radarSize, 0);
    this.face.background = GuiStyles.colors.panelBgLight;
    this.face.color = GuiStyles.colors.border;
    this.face.thickness = 2;
    this.radarWrapper.addControl(this.face);

    for (let i = 1; i <= 3; i++) {
      const ringSize = this.radarSize - i * 42;
      const ring = this.createCircle(`radarRing_${i}`, ringSize, 1);
      ring.background = "transparent";
      ring.color = "rgba(80, 150, 200, 0.2)";
      ring.thickness = 1;
      this.face.addControl(ring);
    }

    this.addCrosshairLine("radarCrossH", "100%", "1px", 0);
    this.addCrosshairLine("radarCrossV", "1px", "100%", 0);

    this.bearingLine = new Rectangle("radarBearingLine");
    this.bearingLine.height = "2px";
    this.bearingLine.thickness = 0;
    this.bearingLine.background = GuiStyles.colors.successGlow;
    this.bearingLine.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.bearingLine.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.bearingLine.isVisible = false;
    this.bearingLine.isHitTestVisible = false;
    this.face.addControl(this.bearingLine);

    this.primaryHalo = new Rectangle("radarPrimaryHalo");
    this.primaryHalo.width = "22px";
    this.primaryHalo.height = "22px";
    this.primaryHalo.cornerRadius = 11;
    this.primaryHalo.thickness = 2;
    this.primaryHalo.color = GuiStyles.colors.success;
    this.primaryHalo.background = GuiStyles.colors.successDim;
    this.primaryHalo.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.primaryHalo.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.primaryHalo.isVisible = false;
    this.primaryHalo.isHitTestVisible = false;
    this.face.addControl(this.primaryHalo);

    for (let i = 0; i < MAX_BLIPS; i++) {
      const blip = new Rectangle(`radarBlip_${i}`);
      blip.width = "10px";
      blip.height = "10px";
      blip.cornerRadius = 5;
      blip.thickness = 0;
      blip.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      blip.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      blip.isVisible = false;
      blip.isHitTestVisible = false;
      this.face.addControl(blip);
      this.blipPool.push(blip);
    }

    this.shipMarker = new TextBlock("radarShip", "▲");
    this.shipMarker.color = GuiStyles.colors.text;
    this.shipMarker.fontSize = 20;
    this.shipMarker.fontWeight = "bold";
    this.shipMarker.width = `${this.radarSize}px`;
    this.shipMarker.height = `${this.radarSize}px`;
    this.shipMarker.outlineWidth = 2;
    this.shipMarker.outlineColor = "rgba(0,0,0,0.8)";
    this.shipMarker.isHitTestVisible = false;
    this.radarWrapper.addControl(this.shipMarker);

    this.rangeLabel = new TextBlock(
      "radarRangeLabel",
      `${Math.round(RADAR_RANGE / 100) * 100} м`
    );
    this.rangeLabel.color = GuiStyles.colors.textDim;
    this.rangeLabel.fontSize = GuiStyles.fontSize.caption;
    this.rangeLabel.height = "14px";
    this.rangeLabel.top = "8px";
    this.rangeLabel.isHitTestVisible = false;
    this.face.addControl(this.rangeLabel);

    this.infoPanel = createGlassPanel(
      "radarInfoPanel",
      this.radarSize + 20,
      GuiStyles.hud.radarInfoHeight,
      true
    );
    this.root.addControl(this.infoPanel);

    const infoStack = createVerticalStack("radarInfoStack", 2);
    infoStack.width = "92%";
    infoStack.paddingTop = "8px";
    infoStack.paddingBottom = "8px";
    this.infoPanel.addControl(infoStack);

    this.hintLabel = styleSectionHeader(new TextBlock("radarHintLabel"), "");
    this.hintLabel.width = "100%";
    this.hintLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    infoStack.addControl(this.hintLabel);

    this.targetLabel = new TextBlock("radarTargetLabel", "");
    this.targetLabel.color = GuiStyles.colors.success;
    this.targetLabel.fontSize = GuiStyles.fontSize.label;
    this.targetLabel.fontWeight = "700";
    this.targetLabel.height = "22px";
    this.targetLabel.width = "100%";
    this.targetLabel.textWrapping = true;
    this.targetLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.targetLabel.isHitTestVisible = false;
    infoStack.addControl(this.targetLabel);

    this.distanceLabel = new TextBlock("radarDistanceLabel", "");
    this.distanceLabel.color = GuiStyles.colors.textMuted;
    this.distanceLabel.fontSize = GuiStyles.fontSize.caption;
    this.distanceLabel.height = "16px";
    this.distanceLabel.width = "100%";
    this.distanceLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.distanceLabel.isHitTestVisible = false;
    infoStack.addControl(this.distanceLabel);
  }

  applyScale(scale: number): void {
    this.root.scaleX = scale;
    this.root.scaleY = scale;
  }

  setNavigation(
    primary: Vector3 | null,
    primaryName: string,
    flightHint: string,
    blips: RadarBlipData[]
  ): void {
    this.primaryTarget = primary ? primary.clone() : null;
    this.primaryName = primaryName;
    this.flightHint = flightHint;
    this.blips = blips.map((b) => ({
      ...b,
      worldPos: b.worldPos.clone(),
    }));
    this.root.isVisible = this.primaryTarget !== null || this.blips.length > 0;
  }

  clear(): void {
    this.setNavigation(null, "", "", []);
    this.hintLabel.text = "";
    this.targetLabel.text = "";
    this.distanceLabel.text = "";
    this.bearingLine.isVisible = false;
    this.primaryHalo.isVisible = false;
    for (const blip of this.blipPool) {
      blip.isVisible = false;
    }
  }

  update(shipPos: Vector3, shipWorldMatrix: Matrix, elapsed = 0): void {
    this.elapsed = elapsed;

    if (!this.primaryTarget && this.blips.length === 0) {
      this.root.isVisible = false;
      return;
    }
    this.root.isVisible = true;
    this.extractHorizontalAxes(shipWorldMatrix);

    const merged = this.mergeBlips();
    let blipIndex = 0;
    let primaryPx = 0;
    let primaryPy = 0;
    let hasPrimaryOnRadar = false;

    for (const blipData of merged) {
      if (blipIndex >= MAX_BLIPS) break;

      const size = blipData.primary ? 14 : blipData.dimmed ? 8 : 11;
      const placed = this.placeBlip(
        blipData.worldPos,
        shipPos,
        this.blipPool[blipIndex],
        blipData.color,
        size,
        blipData.dimmed ? 0.5 : 1
      );

      if (placed) {
        if (blipData.primary) {
          primaryPx = parseFloat(this.blipPool[blipIndex].left as string);
          primaryPy = parseFloat(this.blipPool[blipIndex].top as string);
          hasPrimaryOnRadar = true;
          this.updatePrimaryHalo(primaryPx, primaryPy);
        }
        blipIndex++;
      }
    }

    for (let i = blipIndex; i < MAX_BLIPS; i++) {
      this.blipPool[i].isVisible = false;
    }

    if (hasPrimaryOnRadar) {
      this.updateBearingLine(primaryPx, primaryPy);
    } else {
      this.bearingLine.isVisible = false;
      this.primaryHalo.isVisible = false;
    }

    this.hintLabel.text = this.flightHint.toUpperCase();

    if (this.primaryTarget && this.primaryName) {
      const dist = Vector3.Distance(shipPos, this.primaryTarget);
      this.targetLabel.text = `→ ${this.primaryName}`;
      this.distanceLabel.text = `${Math.round(dist)} м до цели`;
    } else {
      this.targetLabel.text = this.primaryName ? `→ ${this.primaryName}` : "";
      this.distanceLabel.text = "";
    }
  }

  private mergeBlips(): RadarBlipData[] {
    const result: RadarBlipData[] = [];
    const seen = new Set<string>();

    for (const blip of this.blips) {
      const k = this.key(blip.worldPos);
      if (seen.has(k)) continue;
      seen.add(k);
      result.push(blip);
    }

    if (this.primaryTarget) {
      const k = this.key(this.primaryTarget);
      if (!seen.has(k)) {
        result.push({
          worldPos: this.primaryTarget,
          color: GuiStyles.colors.success,
          label: this.primaryName,
          primary: true,
        });
      } else {
        const existing = result.find((b) => this.key(b.worldPos) === k);
        if (existing) {
          existing.primary = true;
          existing.color = GuiStyles.colors.success;
        }
      }
    }

    result.sort((a, b) => (a.primary ? 1 : 0) - (b.primary ? 1 : 0));
    return result;
  }

  private updateBearingLine(px: number, py: number): void {
    const len = Math.sqrt(px * px + py * py);
    if (len < 6) {
      this.bearingLine.isVisible = false;
      return;
    }

    this.bearingLine.width = `${len}px`;
    this.bearingLine.left = `${px / 2}px`;
    this.bearingLine.top = `${py / 2}px`;
    this.bearingLine.rotation = Math.atan2(px, -py);
    this.bearingLine.isVisible = true;
  }

  private updatePrimaryHalo(px: number, py: number): void {
    const pulse = 1 + 0.12 * Math.sin(this.elapsed * 4);
    const size = 22 * pulse;
    this.primaryHalo.width = `${size}px`;
    this.primaryHalo.height = `${size}px`;
    this.primaryHalo.cornerRadius = size / 2;
    this.primaryHalo.left = `${px}px`;
    this.primaryHalo.top = `${py}px`;
    this.primaryHalo.isVisible = true;
  }

  private key(pos: Vector3): string {
    return `${Math.round(pos.x)}_${Math.round(pos.y)}_${Math.round(pos.z)}`;
  }

  private createCircle(name: string, size: number, thickness: number): Rectangle {
    const circle = new Rectangle(name);
    circle.width = `${size}px`;
    circle.height = `${size}px`;
    circle.cornerRadius = size / 2;
    circle.thickness = thickness;
    circle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    circle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    circle.isHitTestVisible = false;
    return circle;
  }

  private addCrosshairLine(
    name: string,
    width: string,
    height: string,
    rotation: number
  ): void {
    const line = new Rectangle(name);
    line.width = width;
    line.height = height;
    line.thickness = 0;
    line.background = "rgba(80, 150, 200, 0.16)";
    line.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    line.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    line.rotation = rotation;
    line.isHitTestVisible = false;
    this.face.addControl(line);
  }

  private extractHorizontalAxes(shipWorldMatrix: Matrix): void {
    Vector3.TransformNormalToRef(
      Vector3.Forward(),
      shipWorldMatrix,
      this.scratchForward
    );
    Vector3.TransformNormalToRef(
      Vector3.Right(),
      shipWorldMatrix,
      this.scratchRight
    );
    this.scratchForward.y = 0;
    this.scratchRight.y = 0;

    if (this.scratchForward.lengthSquared() < 0.0001) {
      this.scratchForward.set(0, 0, 1);
    } else {
      this.scratchForward.normalize();
    }

    if (this.scratchRight.lengthSquared() < 0.0001) {
      Vector3.CrossToRef(Vector3.Up(), this.scratchForward, this.scratchRight);
    } else {
      this.scratchRight.normalize();
    }

    Vector3.CrossToRef(this.scratchForward, this.scratchRight, this.scratchUp);
  }

  private placeBlip(
    worldPos: Vector3,
    shipPos: Vector3,
    blip: Rectangle,
    color: string,
    size: number,
    alpha: number
  ): boolean {
    this.scratchTo.copyFrom(worldPos).subtractInPlace(shipPos);
    const localForward = Vector3.Dot(this.scratchTo, this.scratchForward);
    const localRight = Vector3.Dot(this.scratchTo, this.scratchRight);
    const horizontalDist = Math.sqrt(
      localForward * localForward + localRight * localRight
    );

    if (horizontalDist < 1) {
      blip.isVisible = false;
      return false;
    }

    const scale = Math.min(1, horizontalDist / RADAR_RANGE);
    const px = (localRight / horizontalDist) * scale * this.radarRadiusPx;
    const py = -(localForward / horizontalDist) * scale * this.radarRadiusPx;

    blip.width = `${size}px`;
    blip.height = `${size}px`;
    blip.cornerRadius = size / 2;
    blip.background = color;
    blip.left = `${px}px`;
    blip.top = `${py}px`;
    blip.alpha = alpha;
    blip.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    blip.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    blip.isVisible = true;
    return true;
  }
}
