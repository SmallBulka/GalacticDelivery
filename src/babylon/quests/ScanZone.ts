import {
  Color3,
  GlowLayer,
  Mesh,
  MeshBuilder,
  PhysicsBody,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { Planet } from "../planets/Planet";

export interface ScanZoneConfig {
  orbitOffset?: number;
  radius?: number;
  pushStrength?: number;
  planeThickness?: number;
}

/**
 * Светящийся диск в орбите планеты. Проверяет нахождение корабля и выталкивает его.
 */
export class ScanZone {
  readonly center: Vector3;
  readonly normal: Vector3;
  readonly radius: number;

  private readonly disc: Mesh;
  private readonly ring: Mesh;
  private readonly material: StandardMaterial;
  private readonly pushStrength: number;
  private readonly planeThickness: number;
  private visible = false;

  constructor(
    scene: Scene,
    planet: Planet,
    direction: Vector3,
    glowLayer: GlowLayer,
    config: ScanZoneConfig = {}
  ) {
    const orbitOffset = config.orbitOffset ?? planet.radius + 55;
    this.radius = config.radius ?? 42;
    this.pushStrength = config.pushStrength ?? 18;
    this.planeThickness = config.planeThickness ?? 22;

    this.normal = direction.normalize();
    this.center = planet.position.add(this.normal.scale(orbitOffset));

    this.material = new StandardMaterial("scanZoneMat", scene);
    this.material.emissiveColor = new Color3(0.2, 0.85, 1);
    this.material.diffuseColor = new Color3(0.05, 0.35, 0.5);
    this.material.alpha = 0.42;
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;

    this.disc = MeshBuilder.CreateDisc(
      "scanZoneDisc",
      { radius: this.radius, tessellation: 72, sideOrientation: Mesh.DOUBLESIDE },
      scene
    );
    this.disc.position = this.center.clone();
    this.disc.material = this.material;
    this.disc.isPickable = false;

    this.ring = MeshBuilder.CreateTorus(
      "scanZoneRing",
      {
        diameter: this.radius * 2.05,
        thickness: 1.8,
        tessellation: 64,
      },
      scene
    );
    this.ring.position = this.center.clone();
    this.ring.material = this.material;
    this.ring.isPickable = false;

    const align = Quaternion.FromUnitVectorsToRef(
      Vector3.Up(),
      this.normal,
      new Quaternion()
    );
    this.disc.rotationQuaternion = align.clone();
    this.ring.rotationQuaternion = align.clone();

    glowLayer.addIncludedOnlyMesh(this.disc);
    glowLayer.addIncludedOnlyMesh(this.ring);

    this.setVisible(false);
  }

  setVisible(value: boolean): void {
    this.visible = value;
    this.disc.isVisible = value;
    this.ring.isVisible = value;
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Пульсация диска */
  animate(elapsed: number, scanning: boolean): void {
    if (!this.visible) return;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * (scanning ? 5 : 2.5));
    this.material.alpha = scanning ? 0.5 + pulse * 0.25 : 0.35 + pulse * 0.2;
    this.material.emissiveColor = new Color3(
      0.15 + pulse * 0.15,
      0.7 + pulse * 0.25,
      1
    );
    const scale = 1 + pulse * 0.03;
    this.disc.scaling.set(scale, scale, scale);
  }

  containsPoint(worldPoint: Vector3): boolean {
    const toPoint = worldPoint.subtract(this.center);
    const alongNormal = Vector3.Dot(toPoint, this.normal);
    if (Math.abs(alongNormal) > this.planeThickness) {
      return false;
    }
    const inPlane = toPoint.subtract(this.normal.scale(alongNormal));
    return inPlane.length() <= this.radius;
  }

  applyPushForce(body: PhysicsBody, shipCenter: Vector3, dt: number): void {
    if (!this.containsPoint(shipCenter)) return;
    body.applyImpulse(this.normal.scale(this.pushStrength * dt), shipCenter);
  }

  dispose(): void {
    this.material.dispose();
    this.disc.dispose();
    this.ring.dispose();
  }
}
