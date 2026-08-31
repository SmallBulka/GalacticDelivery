import {
  Color3,
  Color4,
  Engine,
  GlowLayer,
  Mesh,
  NoiseProceduralTexture,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { Planet, PlanetCreateOptions } from "./Planet";
import { WORLD_SIZE, clampToWorld, isInsideWorld } from "../world/WorldBounds";

export interface PlanetManagerConfig {
  chunkSize?: number;
  generationDistance?: number;
  chunkUpdateThreshold?: number;
  planetsPerChunk?: number;
  minPlanetSize?: number;
  maxPlanetSize?: number;
  generationDensity?: number;
  worldSize?: number;
}

const QUEST_PLANET_SLOTS = [
  { x: -550, y: 80, z: 420, diameter: 140 },
  { x: 780, y: -60, z: -620, diameter: 180 },
  { x: 220, y: 90, z: -280, diameter: 130 },
  { x: -850, y: 50, z: 280, diameter: 120 },
  { x: 920, y: -40, z: 480, diameter: 150 },
] as const;

const TEXTURE_TYPES = [
  "mars.jpg",
  "neptune.jpg",
  "daymap.jpg",
  "surface.jpg",
  "jupiter.jpg",
];

export class PlanetManager {
  private readonly planets: Planet[] = [];
  private readonly loadedChunks = new Map<string, boolean>();
  private readonly planetDiffuseCache = new Map<string, Texture>();
  private sharedBumpTexture?: Texture;
  private readonly atmosphereMaterial: StandardMaterial;
  private readonly glowLayer: GlowLayer;
  private lastChunkUpdatePos = Vector3.Zero();

  private chunkSize: number;
  private generationDistance: number;
  private chunkUpdateThreshold: number;
  private planetsPerChunk: number;
  private minPlanetSize: number;
  private maxPlanetSize: number;
  private generationDensity: number;
  private worldHalf: number;
  private readonly minPlanetGap = 160;
  private readonly spawnAttempts = 28;

  constructor(
    private scene: Scene,
    config: PlanetManagerConfig = {}
  ) {
    this.chunkSize = config.chunkSize ?? 3000;
    this.generationDistance = config.generationDistance ?? 5000;
    this.chunkUpdateThreshold = config.chunkUpdateThreshold ?? 800;
    this.planetsPerChunk = config.planetsPerChunk ?? 1;
    this.minPlanetSize = config.minPlanetSize ?? 50;
    this.maxPlanetSize = config.maxPlanetSize ?? 600;
    this.generationDensity = config.generationDensity ?? 1;
    this.worldHalf = (config.worldSize ?? WORLD_SIZE) / 2;

    this.atmosphereMaterial = new StandardMaterial(
      "planetAtmosphereMaterial",
      scene
    );
    this.atmosphereMaterial.emissiveColor = new Color3(0.2, 0.5, 0.5);
    this.atmosphereMaterial.alpha = 0.1; //0.05
    this.atmosphereMaterial.alphaMode = Engine.ALPHA_COMBINE;
    this.atmosphereMaterial.backFaceCulling = false;

    this.glowLayer = new GlowLayer("sceneGlow", scene, {
      mainTextureFixedSize: 512,
      blurKernelSize: 20,
      renderingGroupId: 0,
    });
    // Один общий bloom: квест-маркеры + ближайшие pickup
    this.glowLayer.intensity = 0.42;
    this.glowLayer.neutralColor = new Color4(0, 0, 0, 0);

    scene.setRenderingAutoClearDepthStencil(1, false, false, false);
  }

  getGlowLayer(): GlowLayer {
    return this.glowLayer;
  }

  /** Корабль не должен светиться и рисуется поверх bloom. */
  excludeFromGlow(mesh: Mesh): void {
    this.glowLayer.addExcludedMesh(mesh);
    mesh.renderingGroupId = 1;
  }

  getAll(): readonly Planet[] {
    return this.planets;
  }

  getMeshes(): Mesh[] {
    return this.planets.map((p) => p.mesh);
  }

  createPlanet(options: PlanetCreateOptions): Planet | null {
    const placed = this.findFreePosition(
      options.x,
      options.y,
      options.z,
      options.diameter,
      !options.persistent
    );
    if (!placed) {
      return null;
    }
    options = { ...options, x: placed.x, y: placed.y, z: placed.z };

    const diffuseFile =
      TEXTURE_TYPES[Math.floor(Math.random() * TEXTURE_TYPES.length)];

    let diffuseTexture: Texture | undefined;
    try {
      diffuseTexture = this.getPlanetDiffuseTexture(diffuseFile);
    } catch {
      diffuseTexture = new NoiseProceduralTexture("fallbackTex", 512, this.scene);
    }

    const planet = new Planet(
      this.scene,
      {
        ...options,
        diffuseTexture,
        bumpTexture: this.getSharedBumpTexture(),
      },
      this.atmosphereMaterial
    );
    this.planets.push(planet);
    return planet;
  }

  /** Планеты для всех трёх квестов */
  createAllQuestPlanets(): {
    scannerGiver: Planet;
    scannerTarget: Planet;
    ringGiver: Planet;
    courierPickup: Planet;
    courierDelivery: Planet;
  } {
    const scannerGiver = this.requirePlanet({
      x: -550,
      y: 80,
      z: 420,
      diameter: 140,
      persistent: true,
      displayName: "Кеплер-IV",
    });

    const scannerTarget = this.requirePlanet({
      x: 780,
      y: -60,
      z: -620,
      diameter: 180,
      persistent: true,
      displayName: "Aurora-9",
    });

    const ringGiver = this.requirePlanet({
      x: 220,
      y: 90,
      z: -280,
      diameter: 130,
      persistent: true,
      displayName: "Нова-Ринг",
    });

    const courierPickup = this.requirePlanet({
      x: -850,
      y: 50,
      z: 280,
      diameter: 120,
      persistent: true,
      displayName: "Станция Альфа",
    });

    const courierDelivery = this.requirePlanet({
      x: 920,
      y: -40,
      z: 480,
      diameter: 150,
      persistent: true,
      displayName: "Порт Бета",
    });

    return {
      scannerGiver,
      scannerTarget,
      ringGiver,
      courierPickup,
      courierDelivery,
    };
  }

  /** @deprecated используйте createAllQuestPlanets */
  createQuestPlanets(): { giver: Planet; destination: Planet } {
    const all = this.createAllQuestPlanets();
    return { giver: all.scannerGiver, destination: all.scannerTarget };
  }

  createInitialPlanets(count = 6): void {
    let created = 0;
    let attempts = 0;
    const maxAttempts = count * this.spawnAttempts;
    while (created < count && attempts < maxAttempts) {
      attempts++;
      const diameter = 50 + Math.random() * 100;
      const planet = this.createPlanet({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 1000,
        z: (Math.random() - 0.5) * 2000,
        diameter,
      });
      if (planet) created++;
    }
  }

  updateChunks(shipPos: Vector3): void {
    if (
      Vector3.Distance(shipPos, this.lastChunkUpdatePos) <
      this.chunkUpdateThreshold
    ) {
      return;
    }

    this.lastChunkUpdatePos = shipPos.clone();
    const chunkX = Math.floor(shipPos.x / this.chunkSize) * this.chunkSize;
    const chunkY = Math.floor(shipPos.y / this.chunkSize) * this.chunkSize;
    const chunkZ = Math.floor(shipPos.z / this.chunkSize) * this.chunkSize;

    for (
      let x = -this.generationDistance;
      x <= this.generationDistance;
      x += this.chunkSize
    ) {
      for (
        let y = -this.generationDistance / 2;
        y <= this.generationDistance / 2;
        y += this.chunkSize
      ) {
        for (
          let z = -this.generationDistance;
          z <= this.generationDistance;
          z += this.chunkSize
        ) {
          const cx = chunkX + x;
          const cy = chunkY + y;
          const cz = chunkZ + z;
          if (!this.chunkIntersectsWorld(cx, cy, cz)) {
            continue;
          }
          const key = `${cx}_${cy}_${cz}`;
          if (!this.loadedChunks.has(key)) {
            this.generateChunk(cx, cy, cz);
            this.loadedChunks.set(key, true);
          }
        }
      }
    }

    this.cleanupDistantChunks(shipPos);
  }

  updateQuestMarkers(elapsed: number, shipPos: Vector3, influenceRadius: number): void {
    for (const planet of this.planets) {
      if (!planet.getQuestRole()) continue;
      const dist = Vector3.Distance(shipPos, planet.position);
      planet.updateQuestMarker(elapsed, dist, influenceRadius);
    }
  }

  private generateChunk(cx: number, cy: number, cz: number): void {
    const count = Math.floor(this.planetsPerChunk * this.generationDensity);
    for (let i = 0; i < count; i++) {
      const diameter =
        this.minPlanetSize +
        Math.random() * (this.maxPlanetSize - this.minPlanetSize);
      const x = cx + (Math.random() - 0.5) * this.chunkSize;
      const y = cy + (Math.random() - 0.5) * this.chunkSize;
      const z = cz + (Math.random() - 0.5) * this.chunkSize;
      if (!isInsideWorld(x, y, z, this.spawnInset(diameter))) {
        continue;
      }
      this.createPlanet({ x, y, z, diameter });
    }
  }

  private requirePlanet(options: PlanetCreateOptions): Planet {
    const planet = this.createPlanet(options);
    if (!planet) {
      throw new Error(`Не удалось разместить планету ${options.displayName ?? ""}`);
    }
    return planet;
  }

  /**
   * Минимальная дистанция: атмосферы не пересекаются + запас.
   * Атмосфера = 1.5 диаметра → радиус атмосферы = 0.75 * diameter.
   */
  private minSeparation(diameterA: number, diameterB: number): number {
    return (diameterA + diameterB) * 0.75 + this.minPlanetGap;
  }

  private isFarEnough(
    x: number,
    y: number,
    z: number,
    diameter: number,
    checkReserved: boolean
  ): boolean {
    const pos = new Vector3(x, y, z);
    for (const planet of this.planets) {
      const need = this.minSeparation(diameter, planet.diameter);
      if (Vector3.DistanceSquared(pos, planet.position) < need * need) {
        return false;
      }
    }
    if (checkReserved) {
      for (const slot of QUEST_PLANET_SLOTS) {
        const need = this.minSeparation(diameter, slot.diameter);
        const slotPos = new Vector3(slot.x, slot.y, slot.z);
        if (Vector3.DistanceSquared(pos, slotPos) < need * need) {
          return false;
        }
      }
    }
    return true;
  }

  private findFreePosition(
    x: number,
    y: number,
    z: number,
    diameter: number,
    scatter: boolean
  ): Vector3 | null {
    const inset = this.spawnInset(diameter);
    const first = clampToWorld(x, y, z, inset);
    if (this.isFarEnough(first.x, first.y, first.z, diameter, scatter)) {
      return first;
    }

    const scatterRange = scatter ? 1800 : 600;
    for (let i = 0; i < this.spawnAttempts; i++) {
      const candidate = clampToWorld(
        x + (Math.random() - 0.5) * scatterRange,
        y + (Math.random() - 0.5) * scatterRange,
        z + (Math.random() - 0.5) * scatterRange,
        inset
      );
      if (
        this.isFarEnough(
          candidate.x,
          candidate.y,
          candidate.z,
          diameter,
          scatter
        )
      ) {
        return candidate;
      }
    }
    return null;
  }

  /** Атмосфера планеты ≈ 1.5 диаметра — оставляем запас до стен. */
  private spawnInset(diameter: number): number {
    return diameter * 0.75 + 20;
  }

  private chunkIntersectsWorld(cx: number, cy: number, cz: number): boolean {
    const halfChunk = this.chunkSize / 2;
    return (
      Math.abs(cx) - halfChunk <= this.worldHalf &&
      Math.abs(cy) - halfChunk <= this.worldHalf &&
      Math.abs(cz) - halfChunk <= this.worldHalf
    );
  }

  private cleanupDistantChunks(shipPos: Vector3): void {
    const toRemove: string[] = [];

    this.loadedChunks.forEach((_, key) => {
      const [x, y, z] = key.split("_").map(Number);
      if (
        Vector3.Distance(shipPos, new Vector3(x, y, z)) >
        this.generationDistance * 1.5
      ) {
        toRemove.push(key);
      }
    });

    for (const key of toRemove) {
      this.disposeChunk(key);
      this.loadedChunks.delete(key);
    }
  }

  private disposeChunk(chunkKey: string): void {
    const [x, y, z] = chunkKey.split("_").map(Number);

    for (let i = this.planets.length - 1; i >= 0; i--) {
      const planet = this.planets[i];
      if (planet.persistent) continue;

      const px =
        Math.floor(planet.position.x / this.chunkSize) * this.chunkSize;
      const py =
        Math.floor(planet.position.y / this.chunkSize) * this.chunkSize;
      const pz =
        Math.floor(planet.position.z / this.chunkSize) * this.chunkSize;

      if (px === x && py === y && pz === z) {
        planet.dispose();
        this.planets.splice(i, 1);
      }
    }
  }

  private getSharedBumpTexture(): Texture {
    if (!this.sharedBumpTexture) {
      this.sharedBumpTexture = new Texture(
        "./textures/rocky_terrain_03_nor_gl_4k.jpg",
        this.scene
      );
      this.sharedBumpTexture.level = 1.5;
    }
    return this.sharedBumpTexture;
  }

  private getPlanetDiffuseTexture(fileName: string): Texture {
    let texture = this.planetDiffuseCache.get(fileName);
    if (!texture) {
      texture = new Texture(`./textures/${fileName}`, this.scene);
      this.planetDiffuseCache.set(fileName, texture);
    }
    return texture;
  }
}
