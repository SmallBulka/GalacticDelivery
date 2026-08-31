import {
  Color3,
  GlowLayer,
  Material,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";

const PULSE_SPEED = 2.8;
/** Снаружи атмосферы планеты (atmo = 1.5R), чтобы кольцо не «просвечивало». */
const ORBIT_SCALE = 1.72;

const DEFAULT_ATMO_ALPHA = 0.1;

export type QuestMarkerRole = "giver" | "destination";

/**
 * Пульсирующее кольцо, цвет атмосферы и emissive планеты с заданием.
 */
export class PlanetQuestMarker {
  private readonly orbitRing: Mesh;
  private readonly ringMaterial: StandardMaterial;
  private readonly questAtmoMaterial: StandardMaterial;
  private readonly sharedAtmoMaterial: StandardMaterial;
  private readonly atmosphere: Mesh;
  private readonly baseEmissive: Color3;
  private readonly brightEmissive: Color3;
  private readonly planetMaterial: StandardMaterial;
  private visible = true;

  constructor(
    scene: Scene,
    planetMesh: Mesh,
    planetRadius: number,
    role: QuestMarkerRole,
    _glowLayer: GlowLayer,
    atmosphere: Mesh,
    sharedAtmosphereMaterial: StandardMaterial
  ) {
    this.atmosphere = atmosphere;
    this.sharedAtmoMaterial = sharedAtmosphereMaterial;

    this.baseEmissive =
      role === "giver"
        ? new Color3(0.2, 0.65, 1)
        : new Color3(0.25, 1, 0.7);
    this.brightEmissive = this.baseEmissive.scale(2);

    this.ringMaterial = new StandardMaterial(
      `questRingMat_${planetMesh.name}`,
      scene
    );
    this.ringMaterial.emissiveColor = this.baseEmissive.clone();
    this.ringMaterial.diffuseColor = Color3.Black();
    this.ringMaterial.specularColor = Color3.Black();
    this.ringMaterial.alpha = 1;
    this.ringMaterial.transparencyMode = Material.MATERIAL_OPAQUE;
    this.ringMaterial.disableLighting = true;
    this.ringMaterial.backFaceCulling = false;
    this.ringMaterial.disableDepthWrite = false;

    const torusDiameter = planetRadius * 2 * ORBIT_SCALE;
    this.orbitRing = MeshBuilder.CreateTorus(
      `questOrbit_${planetMesh.name}`,
      {
        diameter: torusDiameter,
        thickness: Math.max(2.5, planetRadius * 0.055),
        tessellation: 48,
      },
      scene
    );
    this.orbitRing.parent = planetMesh;
    this.orbitRing.material = this.ringMaterial;
    this.orbitRing.isPickable = false;
    this.orbitRing.rotation.x = Math.PI / 2;
    this.orbitRing.renderingGroupId = planetMesh.renderingGroupId;

    this.questAtmoMaterial = sharedAtmosphereMaterial.clone(
      `questAtmoMat_${planetMesh.name}`
    ) as StandardMaterial;
    this.questAtmoMaterial.emissiveColor = this.baseEmissive.scale(0.85);
    this.questAtmoMaterial.alpha = DEFAULT_ATMO_ALPHA + 0.04;
    this.atmosphere.material = this.questAtmoMaterial;

    this.planetMaterial = planetMesh.material as StandardMaterial;
  }

  setVisible(value: boolean): void {
    this.visible = value;
    this.orbitRing.isVisible = value;

    if (value) {
      this.atmosphere.material = this.questAtmoMaterial;
    } else {
      this.atmosphere.material = this.sharedAtmoMaterial;
      if (this.planetMaterial) {
        this.planetMaterial.emissiveColor = Color3.Black();
      }
    }
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

    const scale = 1 + pulse * 0.025 + proximity * 0.02;
    this.orbitRing.scaling.set(scale, scale, scale);

    // Атмосфера в цвете роли квеста + пульс яркости/прозрачности
    Color3.LerpToRef(
      this.baseEmissive.scale(0.55),
      this.brightEmissive.scale(0.9),
      intensity,
      this.questAtmoMaterial.emissiveColor
    );
    this.questAtmoMaterial.alpha =
      DEFAULT_ATMO_ALPHA + 0.03 + pulse * 0.07 + proximity * 0.06;

    if (this.planetMaterial) {
      this.planetMaterial.emissiveColor = this.baseEmissive.scale(
        0.12 + pulse * 0.18 + proximity * 0.15
      );
    }
  }

  dispose(): void {
    this.atmosphere.material = this.sharedAtmoMaterial;
    this.questAtmoMaterial.dispose();
    this.ringMaterial.dispose();
    this.orbitRing.dispose();
    if (this.planetMaterial) {
      this.planetMaterial.emissiveColor = Color3.Black();
    }
  }
}
