import {
  Color3,
  GlowLayer,
  Material,
  Matrix,
  Mesh,
  PBRMaterial,
  Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { ENERGY_PER_CRATE, ShipEnergy } from "../ship/ShipEnergy";

export interface PickupJarSystemDeps {
  scene: Scene;
  shipEnergy: ShipEnergy;
  getShipPosition: () => Vector3 | null;
  getGlowLayer: () => GlowLayer | undefined;
  setThrustMultiplier: (multiplier: number) => void;
  playPickupSfx: () => void;
  showPickupMessage: (text: string) => void;
}

/**
 * Контейнеры энергии: спавн, подбор, вращение и локальный bloom.
 */
export class PickupJarSystem {
  private readonly boxes: Mesh[] = [];
  private readonly pickupLocalCenters = new Map<Mesh, Vector3>();
  private readonly glowingPickups = new Set<Mesh>();
  private readonly pickupCenterScratch = new Vector3();
  private readonly pickupInvMatrixScratch = new Matrix();

  private pickupJarTemplate: Mesh | null = null;
  private pickupJarId = 0;
  private pickupJarScale = 1;
  private pickupGlowFrame = 0;

  private readonly boxCount = 100;
  private readonly collectDistance = 22;
  private readonly pickupJarTargetSize = 5;

  constructor(private readonly deps: PickupJarSystemDeps) {}

  async generate(): Promise<void> {
    await this.loadTemplate();
    const areaSize = 1000;

    for (let i = 0; i < this.boxCount; i++) {
      this.create(
        (Math.random() - 0.5) * areaSize,
        (Math.random() - 0.5) * areaSize,
        (Math.random() - 0.5) * areaSize
      );
    }
  }

  /** Вращение + подбор + редкий refresh bloom. */
  update(dt: number): void {
    this.updateVisuals(dt);
    this.updateCollection();
  }

  private async loadTemplate(): Promise<void> {
    if (this.pickupJarTemplate) return;

    const result = await SceneLoader.ImportMeshAsync(
      "",
      "./model/",
      "Pickup Jar.glb",
      this.deps.scene
    );

    const meshList = result.meshes.filter(
      (m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0
    );

    let root: Mesh;
    if (meshList.length === 0) {
      throw new Error("Pickup Jar.glb: нет геометрии");
    }
    if (meshList.length === 1) {
      root = meshList[0];
    } else {
      const merged = Mesh.MergeMeshes(
        meshList,
        true,
        true,
        undefined,
        false,
        true
      );
      if (!merged) {
        throw new Error("Pickup Jar.glb: не удалось объединить меши");
      }
      root = merged;
    }

    root.setEnabled(false);
    root.isVisible = false;
    root.isPickable = false;

    const bounds = root.getBoundingInfo().boundingBox;
    const size = bounds.extendSize.scale(2);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    this.pickupJarScale = this.pickupJarTargetSize / maxDim;

    this.applyInnerGlow(root);
    this.pickupJarTemplate = root;
  }

  private applyInnerGlow(mesh: Mesh): void {
    const paint = (mat: Material | null | undefined) => {
      if (!mat) return;
      if (mat instanceof PBRMaterial) {
        if (mat.albedoTexture && !mat.emissiveTexture) {
          mat.emissiveTexture = mat.albedoTexture;
        }
        mat.emissiveColor = Color3.White();
        mat.emissiveIntensity = 0.55;
      } else if (mat instanceof StandardMaterial) {
        if (mat.diffuseTexture && !mat.emissiveTexture) {
          mat.emissiveTexture = mat.diffuseTexture;
        }
        mat.emissiveColor = new Color3(0.55, 0.55, 0.55);
      }
    };

    paint(mesh.material);
    if (mesh.material && "subMaterials" in mesh.material) {
      const multi = mesh.material as { subMaterials?: (Material | null)[] };
      multi.subMaterials?.forEach((m) => paint(m));
    }
  }

  private create(x: number, y: number, z: number): void {
    if (!this.pickupJarTemplate) {
      console.warn("Pickup Jar template ещё не загружен");
      return;
    }

    const id = this.pickupJarId++;
    const jar = this.pickupJarTemplate.clone(`pickupJar_${id}`, null);
    if (!jar) return;

    jar.setEnabled(true);
    jar.isVisible = true;
    jar.isPickable = false;
    jar.position = new Vector3(x, y, z);
    jar.rotation = new Vector3(0, Math.random() * Math.PI * 2, 0);
    jar.scaling.setAll(this.pickupJarScale);
    jar.computeWorldMatrix(true);
    jar.refreshBoundingInfo(true, true);

    const worldCenter = jar.getBoundingInfo().boundingBox.centerWorld;
    jar.getWorldMatrix().invertToRef(this.pickupInvMatrixScratch);
    const localCenter = Vector3.TransformCoordinates(
      worldCenter,
      this.pickupInvMatrixScratch
    );
    this.pickupLocalCenters.set(jar, localCenter);

    this.boxes.push(jar);
  }

  private createReplacement(): void {
    const areaSize = 2000;
    const minShipDistance = 100;
    const maxAttempts = 24;
    const shipPos = this.deps.getShipPosition();
    if (!shipPos) return;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = (Math.random() - 0.5) * areaSize;
      const y = (Math.random() - 0.5) * areaSize;
      const z = (Math.random() - 0.5) * areaSize;
      if (Vector3.Distance(new Vector3(x, y, z), shipPos) > minShipDistance) {
        this.create(x, y, z);
        return;
      }
    }

    const dir = new Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    );
    if (dir.lengthSquared() < 1e-6) {
      dir.set(1, 0, 0);
    } else {
      dir.normalize();
    }
    const pos = shipPos.add(dir.scale(minShipDistance + 50));
    this.create(pos.x, pos.y, pos.z);
  }

  private getWorldCenter(jar: Mesh, out: Vector3): Vector3 {
    const local = this.pickupLocalCenters.get(jar);
    if (!local) {
      out.copyFrom(jar.position);
      return out;
    }
    Vector3.TransformCoordinatesToRef(local, jar.getWorldMatrix(), out);
    return out;
  }

  private updateVisuals(dt: number): void {
    for (const jar of this.boxes) {
      jar.rotation.y += dt * 0.45;
    }

    this.pickupGlowFrame += 1;
    if (this.pickupGlowFrame % 10 === 0) {
      this.refreshNearbyGlow();
    }
  }

  private refreshNearbyGlow(): void {
    const glow = this.deps.getGlowLayer();
    const shipPos = this.deps.getShipPosition();
    if (!glow || !shipPos) return;

    const maxDistSq = 200 * 200;
    const maxCount = 8;
    const scratch = this.pickupCenterScratch;

    const nearest: { jar: Mesh; d: number }[] = [];
    for (const jar of this.boxes) {
      const c = this.getWorldCenter(jar, scratch);
      const d = Vector3.DistanceSquared(shipPos, c);
      if (d <= maxDistSq) {
        nearest.push({ jar, d });
      }
    }

    nearest.sort((a, b) => a.d - b.d);
    const next = new Set(nearest.slice(0, maxCount).map((x) => x.jar));

    for (const jar of this.glowingPickups) {
      if (!next.has(jar)) {
        glow.removeIncludedOnlyMesh(jar);
        this.glowingPickups.delete(jar);
      }
    }

    for (const jar of next) {
      if (!this.glowingPickups.has(jar)) {
        glow.addIncludedOnlyMesh(jar);
        this.glowingPickups.add(jar);
      }
    }
  }

  private updateCollection(): void {
    const shipPos = this.deps.getShipPosition();
    if (!shipPos || this.boxes.length === 0) return;

    const sqrCollectDistance = this.collectDistance * this.collectDistance;
    const glow = this.deps.getGlowLayer();
    const scratch = this.pickupCenterScratch;

    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const box = this.boxes[i];
      const center = this.getWorldCenter(box, scratch);

      if (Vector3.DistanceSquared(shipPos, center) < sqrCollectDistance) {
        if (this.glowingPickups.has(box) && glow) {
          glow.removeIncludedOnlyMesh(box);
          this.glowingPickups.delete(box);
        }
        this.pickupLocalCenters.delete(box);
        box.dispose();
        this.boxes.splice(i, 1);

        this.deps.shipEnergy.collectCrate();
        this.deps.setThrustMultiplier(
          this.deps.shipEnergy.getThrustMultiplier()
        );
        this.deps.playPickupSfx();
        this.deps.showPickupMessage(
          `Контейнер: +${ENERGY_PER_CRATE}% энергии`
        );

        this.createReplacement();
      }
    }
  }
}
