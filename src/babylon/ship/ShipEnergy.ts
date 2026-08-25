/**
 * Заряд корабля: расход от пройденной дистанции, пополнение контейнерами.
 */
export const ENERGY_MAX = 100;
export const ENERGY_PER_CRATE = 10;
/** Сколько единиц пути нужно пролететь, чтобы потратить 1% заряда. */
export const DISTANCE_PER_ENERGY_PERCENT = 90;

export class ShipEnergy {
  private energy = ENERGY_MAX;
  private cratesCollected = 0;
  private distanceAcc = 0;
  private lastPos: { x: number; y: number; z: number } | null = null;
  private emptyNotified = false;

  getEnergy(): number {
    return this.energy;
  }

  getCratesCollected(): number {
    return this.cratesCollected;
  }

  /** 1 — полёт с тягой, 0 — топлива нет. */
  getThrustMultiplier(): number {
    return this.energy > 0 ? 1 : 0;
  }

  reset(): void {
    this.energy = ENERGY_MAX;
    this.cratesCollected = 0;
    this.distanceAcc = 0;
    this.lastPos = null;
    this.emptyNotified = false;
  }

  /**
   * Учёт перемещения за кадр. Возвращает true, если заряд только что закончился.
   */
  updateFromPosition(x: number, y: number, z: number): boolean {
    if (!this.lastPos) {
      this.lastPos = { x, y, z };
      return false;
    }

    const dx = x - this.lastPos.x;
    const dy = y - this.lastPos.y;
    const dz = z - this.lastPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    this.lastPos = { x, y, z };

    if (dist < 0.001 || this.energy <= 0) {
      return false;
    }

    this.distanceAcc += dist;
    while (this.distanceAcc >= DISTANCE_PER_ENERGY_PERCENT && this.energy > 0) {
      this.distanceAcc -= DISTANCE_PER_ENERGY_PERCENT;
      this.energy = Math.max(0, this.energy - 1);
    }

    if (this.energy <= 0 && !this.emptyNotified) {
      this.emptyNotified = true;
      return true;
    }
    return false;
  }

  /** Подбор контейнера: +10% заряда, счётчик +1. */
  collectCrate(): void {
    this.cratesCollected += 1;
    this.energy = Math.min(ENERGY_MAX, this.energy + ENERGY_PER_CRATE);
    if (this.energy > 0) {
      this.emptyNotified = false;
    }
  }
}
