import {
  Color3,
  GlowLayer,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { PlanetQuestMarker, QuestMarkerRole } from "./PlanetQuestMarker";

export interface PlanetCreateOptions {
  x: number;
  y: number;
  z: number;
  diameter: number;
  diffuseTexture?: Texture;
  bumpTexture?: Texture;
  persistent?: boolean;
  displayName?: string;
}

let planetIdCounter = 0;

export class Planet {
  readonly id: string;
  readonly mesh: Mesh;
  readonly atmosphere: Mesh;
  readonly diameter: number;
  readonly persistent: boolean;
  readonly displayName: string;

  private questMarker?: PlanetQuestMarker;
  private questRole?: QuestMarkerRole;

  constructor(
    private scene: Scene,
    options: PlanetCreateOptions,
    sharedAtmosphereMaterial: StandardMaterial
  ) {
    this.id = `planet_${planetIdCounter++}`;
    this.diameter = options.diameter;
    this.persistent = options.persistent ?? false;
    this.displayName = options.displayName ?? this.id;

    this.mesh = MeshBuilder.CreateSphere(
      `${this.id}_mesh`,
      { diameter: options.diameter, segments: 32 },
      scene
    );
    this.mesh.position = new Vector3(options.x, options.y, options.z);

    const planetMaterial = new StandardMaterial(`${this.id}_mat`, scene);
    planetMaterial.diffuseColor = new Color3(0.8, 0.8, 0.8);
    planetMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    planetMaterial.specularPower = 5;
    planetMaterial.roughness = 0.85;
    planetMaterial.emissiveColor = Color3.Black();

    if (options.diffuseTexture) {
      planetMaterial.diffuseTexture = options.diffuseTexture;
    }
    if (options.bumpTexture) {
      planetMaterial.bumpTexture = options.bumpTexture;
    }

    this.mesh.material = planetMaterial;

    const atmosphereSize = options.diameter * 1.5;
    this.atmosphere = MeshBuilder.CreateSphere(
      `${this.id}_atmo`,
      { diameter: atmosphereSize, segments: 32 },
      scene
    );
    this.atmosphere.parent = this.mesh;
    this.atmosphere.material = sharedAtmosphereMaterial;
    this.atmosphere.isPickable = false;
    this.atmosphere.receiveShadows = false;

    new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.SPHERE,
      { mass: 0, friction: 0.7, restitution: 0 },
      scene
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  get radius(): number {
    return this.diameter / 2;
  }

  /** Радиус сферы атмосферы (diameter × 1.5 от центра планеты). */
  getAtmosphereRadius(): number {
    return this.radius * 1.5;
  }

  markQuestTarget(role: QuestMarkerRole, glowLayer: GlowLayer): void {
    this.questRole = role;
    const sharedAtmo = this.atmosphere.material as StandardMaterial;
    this.questMarker = new PlanetQuestMarker(
      this.scene,
      this.mesh,
      this.radius,
      role,
      glowLayer,
      this.atmosphere,
      sharedAtmo
    );
  }

  getQuestRole(): QuestMarkerRole | undefined {
    return this.questRole;
  }

  updateQuestMarker(elapsed: number, shipDistance: number, influenceRadius: number): void {
    this.questMarker?.update(elapsed, shipDistance, influenceRadius);
  }

  setQuestMarkerVisible(visible: boolean): void {
    this.questMarker?.setVisible(visible);
  }

  dispose(): void {
    this.questMarker?.dispose();
    this.atmosphere.dispose();
    this.mesh.getChildMeshes().forEach((m) => m.dispose());
    this.mesh.dispose();
  }
}
