import {
  Color3,
  Color4,
  GlowLayer,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Quaternion,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { Planet } from "../planets/Planet";

const RING_OUTER = 38;
const RING_INNER = 16;
const PLANE_THICKNESS = 14;

interface RingData {
  index: number;
  center: Vector3;
  normal: Vector3;
  torus: Mesh;
  particles: ParticleSystem;
  material: StandardMaterial;
  passed: boolean;
}

/**
 * Пять светящихся колец-чекпоинтов. Пролёт строго по порядку.
 */
export class RingCheckpointField {
  private readonly rings: RingData[] = [];
  private visible = false;

  constructor(
    scene: Scene,
    anchor: Planet,
    glowLayer: GlowLayer
  ) {
    const start = anchor.position.add(new Vector3(0, 20, anchor.radius + 80));
    const pathDir = new Vector3(1, 0.08, -0.35).normalize();
    const side = Vector3.Cross(pathDir, Vector3.Up()).normalize();

    for (let i = 0; i < 5; i++) {
      const along = pathDir.scale(95 * i);
      const wave = side.scale(Math.sin(i * 1.2) * 55);
      const center = start.add(along).add(wave);
      const normal = Vector3.Cross(pathDir, side).normalize();

      const material = new StandardMaterial(`ringMat_${i}`, scene);
      material.emissiveColor = new Color3(1, 0.55, 0.15);
      material.diffuseColor = new Color3(0.4, 0.15, 0);
      material.alpha = 0.75;
      material.disableLighting = true;

      const torus = MeshBuilder.CreateTorus(
        `checkpointRing_${i}`,
        { diameter: RING_OUTER * 2, thickness: 2.4, tessellation: 48 },
        scene
      );
      torus.position = center;
      torus.material = material;
      torus.isPickable = false;

      const align = Quaternion.FromUnitVectorsToRef(
        Vector3.Up(),
        normal,
        new Quaternion()
      );
      torus.rotationQuaternion = align;

      const particles = new ParticleSystem(`ringParticles_${i}`, 120, scene);
      particles.particleTexture = new Texture("./textures/01.jpg", scene);
      particles.emitter = center;
      particles.minEmitBox = new Vector3(-RING_OUTER, -RING_OUTER, -2);
      particles.maxEmitBox = new Vector3(RING_OUTER, RING_OUTER, 2);
      particles.color1 = new Color4(1, 0.6, 0.1, 0.55);
      particles.color2 = new Color4(1, 0.3, 0, 0.25);
      particles.minSize = 0.4;
      particles.maxSize = 1.6;
      particles.emitRate = 35;
      particles.minLifeTime = 0.4;
      particles.maxLifeTime = 0.9;
      particles.direction1 = normal.scale(-1);
      particles.direction2 = normal;
      particles.gravity = Vector3.Zero();

      glowLayer.addIncludedOnlyMesh(torus);

      this.rings.push({
        index: i,
        center,
        normal,
        torus,
        particles,
        material,
        passed: false,
      });
    }

    this.setVisible(false);
  }

  setVisible(value: boolean): void {
    this.visible = value;
    for (const ring of this.rings) {
      ring.torus.isVisible = value && !ring.passed;
      if (value && !ring.passed) {
        ring.particles.start();
      } else {
        ring.particles.stop();
      }
    }
  }

  getPassedCount(): number {
    return this.rings.filter((r) => r.passed).length;
  }

  getTotalCount(): number {
    return this.rings.length;
  }

  isComplete(): boolean {
    return this.getPassedCount() >= this.rings.length;
  }

  /** Проверка пролёта следующего кольца по порядку */
  tryPassRing(shipPos: Vector3): boolean {
    const next = this.rings.find((r) => !r.passed);
    if (!next || !this.visible) return false;

    const toShip = shipPos.subtract(next.center);
    const alongNormal = Vector3.Dot(toShip, next.normal);
    if (Math.abs(alongNormal) > PLANE_THICKNESS) return false;

    const inPlane = toShip.subtract(next.normal.scale(alongNormal));
    const dist = inPlane.length();
    if (dist < RING_INNER || dist > RING_OUTER) return false;

    next.passed = true;
    next.torus.isVisible = false;
    next.particles.stop();
    next.material.emissiveColor = new Color3(0.2, 1, 0.45);
    return true;
  }

  animate(elapsed: number): void {
    if (!this.visible) return;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4);
    for (const ring of this.rings) {
      if (ring.passed) continue;
      ring.material.emissiveColor = new Color3(
        1,
        0.45 + pulse * 0.25,
        0.1 + pulse * 0.15
      );
      ring.torus.scaling.setAll(1 + pulse * 0.04);
    }
  }

  dispose(): void {
    for (const ring of this.rings) {
      ring.material.dispose();
      ring.particles.dispose();
      ring.torus.dispose();
    }
    this.rings.length = 0;
  }
}
