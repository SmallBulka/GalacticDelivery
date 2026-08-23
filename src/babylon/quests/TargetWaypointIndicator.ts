import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";

/**
 * 3D-навигатор над кораблём: стрелка указывает направление к цели квеста.
 * Лицом к камере (третье лицо сзади), чтобы игрок всегда видел иконку.
 */
export class TargetWaypointIndicator {
  private readonly mesh: Mesh;
  private readonly material: StandardMaterial;
  private readonly texture: Texture;
  private target: Vector3 | null = null;

  /** Над корпусом и чуть впереди — в поле зрения follow-камеры */
  private readonly offset = new Vector3(0, 5.0, 2.5);
  /** Примерная позиция камеры относительно корабля (как followOffset) */
  private readonly cameraLocal = new Vector3(0, 5, -18);

  private readonly lookScratch = new Vector3();
  private readonly faceScratch = new Vector3();
  private readonly upScratch = new Vector3();
  private readonly cameraScratch = new Vector3();
  private visible = false;

  constructor(scene: Scene) {
    this.texture = new Texture(
      "./textures/Indicator-icon.png",
      scene,
      false,
      true,
      Texture.TRILINEAR_SAMPLINGMODE
    );
    this.texture.hasAlpha = true;
    this.texture.getAlphaFromRGB = true;

    this.material = new StandardMaterial("questWaypointIndicatorMat", scene);
    this.material.diffuseTexture = this.texture;
    this.material.emissiveTexture = this.texture;
    this.material.opacityTexture = this.texture;
    this.material.useAlphaFromDiffuseTexture = true;
    this.material.diffuseColor = Color3.White();
    this.material.emissiveColor = new Color3(0.45, 1, 0.65);
    this.material.specularColor = Color3.Black();
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.material.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;

    this.mesh = MeshBuilder.CreatePlane(
      "questWaypointIndicator",
      { width: 3.0, height: 3.0, sideOrientation: Mesh.DOUBLESIDE },
      scene
    );
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    this.mesh.renderingGroupId = 1;
    this.mesh.isVisible = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
  }

  setTarget(worldPos: Vector3 | null): void {
    this.target = worldPos ? worldPos.clone() : null;
    this.visible = this.target !== null;
    this.mesh.isVisible = this.visible;
  }

  clear(): void {
    this.setTarget(null);
  }

  /**
   * Держит маркер над кораблём; стрелка (локальный +Y) смотрит на цель,
   * плоскость повёрнута лицом к камере.
   */
  update(shipWorldPos: Vector3, shipWorldMatrix: Matrix, elapsed: number): void {
    if (!this.visible || !this.target) {
      this.mesh.isVisible = false;
      return;
    }

    Vector3.TransformCoordinatesToRef(
      this.offset,
      shipWorldMatrix,
      this.mesh.position
    );

    this.lookScratch.copyFrom(this.target).subtractInPlace(this.mesh.position);
    if (this.lookScratch.lengthSquared() < 80) {
      this.mesh.isVisible = false;
      return;
    }
    this.lookScratch.normalize();

    // Лицом к камере: направление от маркера к приблизительной позиции камеры
    Vector3.TransformCoordinatesToRef(
      this.cameraLocal,
      shipWorldMatrix,
      this.cameraScratch
    );
    this.faceScratch.copyFrom(this.cameraScratch).subtractInPlace(this.mesh.position);
    if (this.faceScratch.lengthSquared() < 0.0001) {
      this.faceScratch.copyFrom(shipWorldPos).subtractInPlace(this.mesh.position);
    }
    this.faceScratch.normalize();

    // Стрелка на текстуре смотрит вдоль локального +Y → up = направление к цели
    this.upScratch.copyFrom(this.lookScratch);
    const parallel = Math.abs(Vector3.Dot(this.faceScratch, this.upScratch));
    if (parallel > 0.95) {
      Vector3.TransformNormalToRef(Vector3.Up(), shipWorldMatrix, this.upScratch);
      if (this.upScratch.lengthSquared() < 0.0001) {
        this.upScratch.copyFrom(Vector3.Up());
      } else {
        this.upScratch.normalize();
      }
    }

    if (!this.mesh.rotationQuaternion) {
      this.mesh.rotationQuaternion = Quaternion.Identity();
    }
    Quaternion.FromLookDirectionLHToRef(
      this.faceScratch,
      this.upScratch,
      this.mesh.rotationQuaternion
    );

    const pulse = 0.94 + 0.08 * Math.sin(elapsed * 3.2);
    this.mesh.scaling.setAll(pulse);
    this.material.emissiveColor.set(
      0.35 + pulse * 0.25,
      0.85 + pulse * 0.15,
      0.5 + pulse * 0.25
    );
    this.mesh.isVisible = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
