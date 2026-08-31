import {
  Matrix,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  Scene,
  TransformNode,
  Texture,
  Color3,
  StandardMaterial,
  Vector3,
  PhysicsShapeSphere,
} from "@babylonjs/core";
import { WORLD_SIZE, randomPointInWorld } from "./world/WorldBounds";

const ASTEROID_BATCH_SIZE = 200;
const ASTEROID_RADIUS = 7;
const ASTEROID_SPAWN_INSET = ASTEROID_RADIUS + 20;

/** Включать физику внутри этого радиуса от корабля. */
const PHYSICS_ACTIVATE_DIST = 120;
/** Выключать физику за этим радиусом (гистерезис). */
const PHYSICS_DEACTIVATE_DIST = 160;
/** Максимум одновременных физ. тел астероидов. */
const MAX_ACTIVE_PHYSICS = 48;
/** Как часто пересчитывать активный набор (кадры). */
const PHYSICS_SYNC_FRAMES = 8;

interface ActiveAsteroidPhysics {
  index: number;
  node: TransformNode;
  aggregate: PhysicsAggregate;
  shape: PhysicsShapeSphere;
}

/**
 * Поле астероидов: все 6000 — thin instances (рендер),
 * физика Havok только у ближайших к кораблю.
 * Без собственного GlowLayer — общий bloom сцены в PlanetManager.
 */
export default class AsteroidsController {
  private scene: Scene;
  private parentAsteroid!: Mesh;
  private asteroidMaterial!: StandardMaterial;
  private worldSize: number;
  private asteroidsCount = 6000;
  private physicsRoot: TransformNode;
  /** xyz xyz … длина asteroidsCount * 3 */
  private positions!: Float32Array;
  private activePhysics = new Map<number, ActiveAsteroidPhysics>();
  private frameCounter = 0;

  constructor(scene: Scene, worldSize = WORLD_SIZE) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.createAsteroidMaterial();
    this.createParentAsteroid();
    this.physicsRoot = new TransformNode("asteroidPhysicsRoot", this.scene);
    this.positions = new Float32Array(this.asteroidsCount * 3);
  }

  private createParentAsteroid(): void {
    this.parentAsteroid = MeshBuilder.CreateSphere(
      "parentAsteroid",
      { diameter: ASTEROID_RADIUS * 2, segments: 4, updatable: false },
      this.scene
    );
    this.parentAsteroid.material = this.asteroidMaterial;
    this.parentAsteroid.isPickable = false;
    this.parentAsteroid.thinInstanceEnablePicking = false;
  }

  private createAsteroidMaterial(): void {
    this.asteroidMaterial = new StandardMaterial("asteroidMaterial", this.scene);
    const noiseTexture = new Texture("./textures/coral.png", this.scene);
    this.asteroidMaterial.diffuseTexture = noiseTexture;
    this.asteroidMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    // Без GlowLayer — умеренный emissive, чтобы не «мылить» кадр
    this.asteroidMaterial.emissiveColor = new Color3(0.12, 0.12, 0.12);
  }

  public async initialize(
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    await this.generateAsteroidField(onProgress);
    console.log(
      `Asteroids: ${this.asteroidsCount} thin instances, physics ≤${MAX_ACTIVE_PHYSICS} near ship (${this.worldSize}³)`
    );
  }

  /**
   * Синхронизация локальной физики вокруг корабля.
   * Вызывать из игрового цикла.
   */
  public update(shipPosition: Vector3): void {
    this.frameCounter += 1;
    if (this.frameCounter % PHYSICS_SYNC_FRAMES !== 0) return;
    this.syncNearbyPhysics(shipPosition);
  }

  private async generateAsteroidField(
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < this.asteroidsCount; i++) {
      const position = randomPointInWorld(ASTEROID_SPAWN_INSET);
      this.createAsteroidVisual(i, position);

      if ((i + 1) % ASTEROID_BATCH_SIZE === 0 || i + 1 === this.asteroidsCount) {
        onProgress?.(i + 1, this.asteroidsCount);
        await this.yieldToBrowser();
      }
    }
  }

  private yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  private createAsteroidVisual(index: number, position: Vector3): void {
    const base = index * 3;
    this.positions[base] = position.x;
    this.positions[base + 1] = position.y;
    this.positions[base + 2] = position.z;

    const matrix = Matrix.Translation(position.x, position.y, position.z);
    this.parentAsteroid.thinInstanceAdd(matrix);
  }

  private syncNearbyPhysics(shipPosition: Vector3): void {
    const activateSq = PHYSICS_ACTIVATE_DIST * PHYSICS_ACTIVATE_DIST;
    const deactivateSq = PHYSICS_DEACTIVATE_DIST * PHYSICS_DEACTIVATE_DIST;
    const sx = shipPosition.x;
    const sy = shipPosition.y;
    const sz = shipPosition.z;

    const toDeactivate: number[] = [];
    for (const [index] of this.activePhysics) {
      if (this.distSqToIndex(index, sx, sy, sz) > deactivateSq) {
        toDeactivate.push(index);
      }
    }
    for (const index of toDeactivate) {
      const active = this.activePhysics.get(index);
      if (active) this.deactivatePhysics(index, active);
    }

    if (this.activePhysics.size >= MAX_ACTIVE_PHYSICS) return;

    const candidates: { index: number; dSq: number }[] = [];
    for (let i = 0; i < this.asteroidsCount; i++) {
      if (this.activePhysics.has(i)) continue;
      const dSq = this.distSqToIndex(i, sx, sy, sz);
      if (dSq <= activateSq) {
        candidates.push({ index: i, dSq });
      }
    }

    candidates.sort((a, b) => a.dSq - b.dSq);

    const slots = MAX_ACTIVE_PHYSICS - this.activePhysics.size;
    for (let c = 0; c < candidates.length && c < slots; c++) {
      this.activatePhysics(candidates[c].index);
    }
  }

  private distSqToIndex(
    index: number,
    sx: number,
    sy: number,
    sz: number
  ): number {
    const base = index * 3;
    const dx = this.positions[base] - sx;
    const dy = this.positions[base + 1] - sy;
    const dz = this.positions[base + 2] - sz;
    return dx * dx + dy * dy + dz * dz;
  }

  private activatePhysics(index: number): void {
    if (this.activePhysics.has(index)) return;

    const base = index * 3;
    const node = new TransformNode(`asteroidPhys_${index}`, this.scene);
    node.position.set(
      this.positions[base],
      this.positions[base + 1],
      this.positions[base + 2]
    );
    this.physicsRoot.addChild(node);

    const shape = new PhysicsShapeSphere(
      Vector3.Zero(),
      ASTEROID_RADIUS,
      this.scene
    );
    const aggregate = new PhysicsAggregate(
      node,
      shape,
      { mass: 0, restitution: 0.7 },
      this.scene
    );

    this.activePhysics.set(index, { index, node, aggregate, shape });
  }

  private deactivatePhysics(index: number, active: ActiveAsteroidPhysics): void {
    // Aggregate владеет shape — dispose тела достаточно.
    active.aggregate.dispose();
    active.node.dispose();
    this.activePhysics.delete(index);
  }

  public dispose(): void {
    for (const [index, active] of this.activePhysics) {
      this.deactivatePhysics(index, active);
    }
    this.parentAsteroid.dispose();
    this.asteroidMaterial.dispose();
    this.physicsRoot.dispose();
  }
}
