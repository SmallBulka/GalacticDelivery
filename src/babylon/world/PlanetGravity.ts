import { PhysicsBody, Vector3 } from "@babylonjs/core";
import { Planet } from "../planets/Planet";

/**
 * Мягкое притяжение планет — игровой «колодец», не N-body орбиты.
 * Ближе и крупнее планета → сильнее тяга; у поверхности сила гасится,
 * чтобы не швыряло в коллизию.
 */
export interface PlanetGravityConfig {
  /** Множитель силы (тюнинг ощущения). */
  strength: number;
  /** Радиус влияния = radius × influenceScale. */
  influenceScale: number;
  /** Внутри radius × surfaceMargin силу не даём (зона коллизии). */
  surfaceMargin: number;
  /** Опорный радиус планеты для нормализации «массы». */
  referenceRadius: number;
}

const DEFAULT_CONFIG: PlanetGravityConfig = {
  /** Заметно гнёт курс даже на крейсерской скорости. */
  strength: 185,
  /** Зона ≈ 12 радиусов планеты (для r=70 → ~840 ед.). */
  influenceScale: 4,
  surfaceMargin: 1.08,
  /** Ниже — мелкие планеты тоже тянут ощутимо. */
  referenceRadius: 55,
};

export class PlanetGravity {
  private readonly config: PlanetGravityConfig;
  private readonly scratchDir = new Vector3();

  constructor(
    private getShipBody: () => PhysicsBody | undefined,
    private getShipPosition: () => Vector3,
    private getPlanets: () => readonly Planet[],
    config?: Partial<PlanetGravityConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Вызывать из onBeforePhysicsObservable. */
  update(dt: number): void {
    if (dt <= 0 || dt > 0.1) return;

    const body = this.getShipBody();
    if (!body) return;

    const shipPos = this.getShipPosition();
    const {
      strength,
      influenceScale,
      surfaceMargin,
      referenceRadius,
    } = this.config;

    for (const planet of this.getPlanets()) {
      const r = planet.radius;
      if (r < 1) continue;

      planet.position.subtractToRef(shipPos, this.scratchDir);
      const distSq = this.scratchDir.lengthSquared();
      const dist = Math.sqrt(distSq);
      if (dist < 1e-3) continue;

      const inner = r * surfaceMargin;
      const outer = r * influenceScale;
      if (dist <= inner || dist >= outer) continue;

      // «Масса» ∝ радиусу — крупные сильнее, мелкие тоже заметны.
      const massFactor = Math.max(0.45, r / referenceRadius);
      // 1 у поверхности, 0 на краю; степень < 1 — тяга чувствуется дальше.
      const t = 1 - (dist - inner) / (outer - inner);
      const falloff = Math.pow(Math.max(0, t), 0.55);
      // Ближе к планете чуть сильнее, без жёсткого 1/r² на краю зоны.
      const nearBoost = 0.4 + 0.6 * (r / dist);

      const forceMag = strength * massFactor * falloff * nearBoost;
      this.scratchDir.scaleInPlace(forceMag / dist);

      // Импульс ≈ F·dt — стабильнее для непрерывной тяги в Havok.
      body.applyImpulse(this.scratchDir.scale(dt), shipPos);
    }
  }
}
