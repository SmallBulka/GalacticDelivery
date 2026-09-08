import { describe, expect, it } from "vitest";
import {
  DISTANCE_PER_ENERGY_PERCENT,
  ENERGY_MAX,
  ENERGY_PER_CRATE,
  ShipEnergy,
} from "./ShipEnergy";

describe("ShipEnergy", () => {
  it("тратит заряд за дистанцию и пополняет контейнером", () => {
    const energy = new ShipEnergy();
    expect(energy.getEnergy()).toBe(ENERGY_MAX);

    energy.updateFromPosition(0, 0, 0);
    energy.updateFromPosition(DISTANCE_PER_ENERGY_PERCENT, 0, 0);
    expect(energy.getEnergy()).toBe(ENERGY_MAX - 1);

    energy.collectCrate();
    expect(energy.getEnergy()).toBe(ENERGY_MAX);
    expect(energy.getCratesCollected()).toBe(1);
    expect(ENERGY_PER_CRATE).toBe(10);
  });
});
