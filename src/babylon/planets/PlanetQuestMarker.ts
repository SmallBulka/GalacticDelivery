import {
  Color3,
  GlowLayer,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";

const PULSE_SPEED = 2.8;
const ORBIT_SCALE = 1.35;

export type QuestMarkerRole = "giver" | "destination";

/**
 * Пульсирующее кольцо и emissive-подсветка планеты с заданием.
 */
export class PlanetQuestMarker {
  private readonly orbitRing: Mesh;
  private readonly ringMaterial: StandardMaterial;
  private readonly baseEmissive: Color3;
  private readonly brightEmissive: Color3;
  private readonly planetMaterial: StandardMaterial;
  private visible = true;

  constructor(
    scene: Scene,
    planetMesh: Mesh,
    planetRadius: number,
    role: QuestMarkerRole,
    glowLayer: GlowLayer
  ) {
    this.baseEmissive =
      role === "giver"
        ? new Color3(0.15, 0.55, 1)
        : new Color3(0.2, 1, 0.65);
    this.brightEmissive = this.baseEmissive.scale(1.8);

    this.ringMaterial = new StandardMaterial(
      `questRingMat_${planetMesh.name}`,
      scene
    );
    this.ringMaterial.emissiveColor = this.baseEmissive.clone();
    this.ringMaterial.diffuseColor = Color3.Black();
    this.ringMaterial.alpha = 0.55;
    this.ringMaterial.disableLighting = true;
    this.ringMaterial.backFaceCulling = false;

    const torusDiameter = planetRadius * 2 * ORBIT_SCALE;
    this.orbitRing = MeshBuilder.CreateTorus(
      `questOrbit_${planetMesh.name}`,
      {
        diameter: torusDiameter,
        thickness: Math.max(2, planetRadius * 0.06),
        tessellation: 48,
      },
      scene
    );
    this.orbitRing.parent = planetMesh;
    this.orbitRing.material = this.ringMaterial;
    this.orbitRing.isPickable = false;
    this.orbitRing.rotation.x = Math.PI / 2;

    glowLayer.addIncludedOnlyMesh(this.orbitRing);

    this.planetMaterial = planetMesh.material as StandardMaterial;
  }

  setVisible(value: boolean): void {
    this.visible = value;
    this.orbitRing.isVisible = value;
  }

  update(elapsedSeconds: number, shipDistance: number, influenceRadius: number): void {
    if (!this.visible) return;

    const proximity = Math.max(0, 1 - shipDistance / influenceRadius);
    const pulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * PULSE_SPEED);
    const intensity = 0.35 + pulse * 0.45 + proximity * 0.35;

    Color3.LerpToRef(
      this.baseEmissive,
      this.brightEmissive,
      intensity,
      this.ringMaterial.emissiveColor
    );
    this.ringMaterial.alpha = 0.35 + pulse * 0.35 + proximity * 0.2;

    const scale = 1 + pulse * 0.04 + proximity * 0.03;
    this.orbitRing.scaling.set(scale, scale, scale);

    if (this.planetMaterial) {
      this.planetMaterial.emissiveColor = this.baseEmissive.scale(
        0.15 + pulse * 0.25 + proximity * 0.2
      );
    }
  }

  dispose(): void {
    this.ringMaterial.dispose();
    this.orbitRing.dispose();
    if (this.planetMaterial) {
      this.planetMaterial.emissiveColor = Color3.Black();
    }
  }
}
