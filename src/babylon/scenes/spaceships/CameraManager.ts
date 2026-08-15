import {
  Scene,
  UniversalCamera,
  Vector3,
  Quaternion,
  Mesh,
} from "@babylonjs/core";
import { IInputState } from "./IInputState";

export enum CameraMode {
  ThirdPerson = "THIRD_PERSON",
  FirstPerson = "FIRST_PERSON",
}

export interface ICameraConfig {
  /** Смещение камеры относительно корабля в 3rd Person (локальные X, Y, Z) */
  followOffset: Vector3;
  /** Смещение в кабине для 1st Person */
  cockpitOffset: Vector3;
  /** Скорость сглаживания позиции */
  positionSmoothness: number;
  /** Скорость сглаживания поворота */
  rotationSmoothness: number;
  /** Множитель выравнивания при thrust > 0 */
  alignmentBoost: number;
  maxZ: number;
}

const DEFAULT_CAMERA_CONFIG: ICameraConfig = {
  followOffset: new Vector3(0, 3, -12),
  cockpitOffset: new Vector3(0, 0.8, 1.2),
  positionSmoothness: 8,
  rotationSmoothness: 5,
  alignmentBoost: 2.5,
  maxZ: 10000,
};

/**
 * Follow-камера. Создаётся без корабля; цель вешается через attachTarget после CreateShip.
 */
export class CameraManager {
  private readonly camera: UniversalCamera;
  private targetMesh: Mesh | null = null;
  private mode: CameraMode = CameraMode.ThirdPerson;
  private readonly config: ICameraConfig;
  private readonly scratchScale = new Vector3();
  private readonly scratchRotation = new Quaternion();
  private readonly scratchPosition = new Vector3();

  constructor(scene: Scene, customConfig?: Partial<ICameraConfig>) {
    this.config = {
      ...DEFAULT_CAMERA_CONFIG,
      ...customConfig,
      followOffset:
        customConfig?.followOffset?.clone() ??
        DEFAULT_CAMERA_CONFIG.followOffset.clone(),
      cockpitOffset:
        customConfig?.cockpitOffset?.clone() ??
        DEFAULT_CAMERA_CONFIG.cockpitOffset.clone(),
    };

    this.camera = new UniversalCamera("shipCamera", Vector3.Zero(), scene);
    this.camera.ignoreParentScaling = true;
    this.camera.rotationQuaternion = Quaternion.Identity();
    this.camera.minZ = 0.1;
    this.camera.maxZ = this.config.maxZ;
    this.camera.inputs.clear();
    scene.activeCamera = this.camera;
  }

  public getCamera(): UniversalCamera {
    return this.camera;
  }

  public hasTarget(): boolean {
    return this.targetMesh !== null;
  }

  /** Привязать корабль после его создания и сразу выровнять камеру. */
  public attachTarget(mesh: Mesh): void {
    this.targetMesh = mesh;
    this.snapToTarget();
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
    if (!this.targetMesh) return;

    if (this.mode === CameraMode.FirstPerson) {
      this.targetMesh.isVisible = false;
    } else {
      this.targetMesh.isVisible = true;
    }
    this.snapToTarget();
  }

  /** Обновление follow (вызывать в beforeRender с актуальным IInputState). */
  public update(input: IInputState, deltaTime: number): void {
    if (!this.targetMesh || deltaTime <= 0) return;

    if (this.mode === CameraMode.ThirdPerson) {
      this.updateThirdPersonFollow(input, deltaTime);
    } else {
      this.updateFirstPersonFollow();
    }
  }

  private snapToTarget(): void {
    if (!this.targetMesh) return;

    const offset =
      this.mode === CameraMode.FirstPerson
        ? this.config.cockpitOffset
        : this.config.followOffset;
    const worldPos = Vector3.TransformCoordinates(
      offset,
      this.targetMesh.getWorldMatrix()
    );
    this.camera.position.copyFrom(worldPos);

    if (this.camera.rotationQuaternion) {
      this.camera.rotationQuaternion.copyFrom(this.getTargetRotation());
    }
  }

  private updateThirdPersonFollow(input: IInputState, deltaTime: number): void {
    if (!this.targetMesh) return;

    const shipTransform = this.targetMesh.getWorldMatrix();
    const targetPosition = Vector3.TransformCoordinates(
      this.config.followOffset,
      shipTransform
    );

    const rotSmoothness =
      input.thrust > 0
        ? this.config.rotationSmoothness * this.config.alignmentBoost
        : this.config.rotationSmoothness;

    const posLerp = Math.min(1, this.config.positionSmoothness * deltaTime);
    Vector3.LerpToRef(
      this.camera.position,
      targetPosition,
      posLerp,
      this.camera.position
    );

    const targetRotation = this.getTargetRotation();
    const rotLerp = Math.min(1, rotSmoothness * deltaTime);

    if (this.camera.rotationQuaternion) {
      Quaternion.SlerpToRef(
        this.camera.rotationQuaternion,
        targetRotation,
        rotLerp,
        this.camera.rotationQuaternion
      );
    }
  }

  private updateFirstPersonFollow(): void {
    if (!this.targetMesh) return;

    const worldCockpitPos = Vector3.TransformCoordinates(
      this.config.cockpitOffset,
      this.targetMesh.getWorldMatrix()
    );
    this.camera.position.copyFrom(worldCockpitPos);

    if (this.camera.rotationQuaternion) {
      this.camera.rotationQuaternion.copyFrom(this.getTargetRotation());
    }
  }

  private getTargetRotation(): Quaternion {
    if (!this.targetMesh) {
      return Quaternion.Identity();
    }

    this.targetMesh
      .getWorldMatrix()
      .decompose(
        this.scratchScale,
        this.scratchRotation,
        this.scratchPosition
      );
    return this.scratchRotation;
  }
}
