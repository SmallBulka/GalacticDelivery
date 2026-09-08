import {
  ISceneLoaderAsyncResult,
  KeyboardEventTypes,
  Mesh,
  PhysicsAggregate,
  PhysicsEventType,
  PhysicsShapeType,
  Quaternion,
  Scene,
  SceneLoader,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import KeyboardController from "./KeyboardController";
import SpaceShipMovementController from "./spaceShipMovementController";
import {
  FlightSettingsConfig,
  mergeFlightSettings,
  saveFlightSettings,
} from "./FlightSettingsConfig";
import { GamepadInputProvider } from "./GamepadInputProvider";
import { CompositeInputProvider } from "./CompositeInputProvider";
import { IInputProvider } from "./IInputProvider";
import { EMPTY_INPUT_STATE, IInputState } from "./IInputState";

/** Скорость до удара (ед/с), выше которой удар считается сильным. */
const STRONG_IMPACT_SPEED = 16;
/** Минимальный импульс Havok для сильного удара. */
const STRONG_IMPACT_IMPULSE = 1.5;
/** Резкое падение скорости между кадрами = удар (физика/стенка). */
const STRONG_IMPACT_SPEED_DROP = 14;
const IMPACT_COOLDOWN_MS = 650;
/** После разморозки (диалог квеста и т.п.) — не считать удары. */
const UNFREEZE_IMPACT_GRACE_MS = 900;

export default class SpaceShip {
  private scene: Scene;
  private moveController!: SpaceShipMovementController;
  public spaceShipBox!: Mesh;
  private assetContainer!: ISceneLoaderAsyncResult;
  public spaceShipAggregate!: PhysicsAggregate;
  private flightSettings: FlightSettingsConfig;
  private inputProvider!: IInputProvider;
  private keyboardController!: KeyboardController;
  private gamepadInput!: GamepadInputProvider;
  /** Множитель тяги от заряда энергии (0 — нет топлива). */
  private thrustMultiplier = 1;
  private onRestart: (() => void) | null = null;
  /** true — управление заблокировано (модальные окна). */
  private controlsLockChecker: (() => boolean) | null = null;
  private onStrongImpact: ((speed: number) => void) | null = null;
  private lastImpactAt = 0;
  private prevVelocity = new Vector3();
  private impactSensorReady = false;
  private wasMovementFrozen = false;
  private impactGraceUntil = 0;

  constructor(scene: Scene, flightSettings?: Partial<FlightSettingsConfig>) {
    this.scene = scene;
    this.flightSettings = mergeFlightSettings(flightSettings);
  }

  public async createSpaceShip() {
    await this.loadSpaceShip();

    const partA = this.assetContainer.meshes[1] as Mesh;
    const partB = this.assetContainer.meshes[2] as Mesh;

    const mergedMesh = Mesh.MergeMeshes(
      [partA, partB],
      true,
      true,
      undefined,
      false,
      true
    );
    if (!mergedMesh) {
      throw new Error("Failed to merge spaceship meshes");
    }

    this.spaceShipBox = mergedMesh;
    this.spaceShipBox.name = "spaceShipBox";
    this.centerMeshGeometry(this.spaceShipBox);
    this.disposeUnusedImportMeshes();

    // Havok обновляет transform через quaternion; euler на том же узле даёт рассинхрон по X/Z.
    this.spaceShipBox.rotation.set(0, 0, 0);
    this.spaceShipBox.rotationQuaternion = Quaternion.Identity();

    this.spaceShipAggregate = new PhysicsAggregate(
      this.spaceShipBox,
      PhysicsShapeType.CONVEX_HULL,
      { mass: 10, mesh: this.spaceShipBox },
      this.scene
    );
    this.spaceShipAggregate.body.setMassProperties({
      mass: 10,
      centerOfMass: Vector3.Zero(),
      inertiaOrientation: Quaternion.Identity(),
    });

    this.spaceShipAggregate.body.setLinearDamping(
      this.flightSettings.linearDamping
    );
    this.spaceShipAggregate.body.setAngularDamping(
      this.flightSettings.angularDamping
    );

    this.bindCollisionImpact();

    this.keyboardController = new KeyboardController(this.scene);
    this.gamepadInput = new GamepadInputProvider(this.scene);
    this.inputProvider = new CompositeInputProvider([
      this.keyboardController,
      this.gamepadInput,
    ]);

    this.moveController = new SpaceShipMovementController(
      this.scene,
      this.spaceShipAggregate,
      this.spaceShipBox,
      () => this.getThrottledInput(),
      this.flightSettings
    );
    this.scene.onAfterPhysicsObservable.add(() => {
      if (!this.isMovementFrozen()) return;
      const body = this.spaceShipAggregate.body;
      body.setLinearVelocity(Vector3.Zero());
      body.setAngularVelocity(Vector3.Zero());
    });
    this.restartObserver();
  }

  /** Модальное окно или нулевой заряд — полная остановка корабля. */
  isMovementFrozen(): boolean {
    if (this.controlsLockChecker?.()) return true;
    return this.thrustMultiplier <= 0;
  }

  setThrustMultiplier(multiplier: number): void {
    this.thrustMultiplier = Math.max(0, Math.min(1, multiplier));
  }

  setControlsLockChecker(checker: (() => boolean) | null): void {
    this.controlsLockChecker = checker;
  }

  setOnStrongImpact(callback: ((speed: number) => void) | null): void {
    this.onStrongImpact = callback;
  }

  /**
   * Детект удара по резкому падению скорости (надёжнее Havok-callback).
   * Вызывать из beforeRender.
   */
  tickImpactSensor(): void {
    if (!this.spaceShipAggregate) return;

    const velocity = this.spaceShipAggregate.body.getLinearVelocity();
    const frozen = this.isMovementFrozen();

    if (frozen) {
      this.prevVelocity.copyFrom(velocity);
      if (!this.impactSensorReady) {
        this.impactSensorReady = true;
      }
      this.wasMovementFrozen = true;
      return;
    }

    if (this.wasMovementFrozen) {
      this.wasMovementFrozen = false;
      this.impactGraceUntil = performance.now() + UNFREEZE_IMPACT_GRACE_MS;
      this.prevVelocity.copyFrom(velocity);
      this.impactSensorReady = true;
      return;
    }

    if (performance.now() < this.impactGraceUntil) {
      this.prevVelocity.copyFrom(velocity);
      return;
    }

    if (!this.impactSensorReady) {
      this.prevVelocity.copyFrom(velocity);
      this.impactSensorReady = true;
      return;
    }

    const prevSpeed = this.prevVelocity.length();
    const speed = velocity.length();
    this.prevVelocity.copyFrom(velocity);

    const drop = prevSpeed - speed;
    if (prevSpeed >= STRONG_IMPACT_SPEED && drop >= STRONG_IMPACT_SPEED_DROP) {
      this.reportStrongImpact(prevSpeed);
    }
  }

  /** Актуальный объединённый ввод (клавиатура + геймпад) для камеры и UI. */
  getInput(): IInputState {
    return this.getThrottledInput();
  }

  private bindCollisionImpact(): void {
    const body = this.spaceShipAggregate.body;
    body.setCollisionCallbackEnabled(true);
    body.getCollisionObservable().add((ev) => {
      if (!this.canDetectImpact()) return;
      if (ev.type === PhysicsEventType.COLLISION_FINISHED) return;
      const speed = this.getSpeed();
      const impulse = typeof ev.impulse === "number" ? ev.impulse : 0;
      if (speed < STRONG_IMPACT_SPEED && impulse < STRONG_IMPACT_IMPULSE) {
        return;
      }
      this.reportStrongImpact(Math.max(speed, impulse * 4));
    });
  }

  private canDetectImpact(): boolean {
    if (this.isMovementFrozen()) return false;
    if (performance.now() < this.impactGraceUntil) return false;
    return true;
  }

  private reportStrongImpact(speed: number): void {
    if (!this.canDetectImpact()) return;
    const now = performance.now();
    if (now - this.lastImpactAt < IMPACT_COOLDOWN_MS) return;
    this.lastImpactAt = now;
    this.onStrongImpact?.(speed);
  }

  private getThrottledInput(): IInputState {
    if (this.isMovementFrozen()) {
      return EMPTY_INPUT_STATE;
    }

    const input = this.inputProvider.getInput();
    if (this.thrustMultiplier >= 1) return input;
    return {
      ...input,
      thrust: input.thrust * this.thrustMultiplier,
    };
  }

  getGamepadStickDisplay() {
    return this.gamepadInput.getStickDisplay();
  }

  getSpeed(): number {
    return this.spaceShipAggregate.body.getLinearVelocity().length();
  }

  getFlightSettings(): FlightSettingsConfig {
    return this.moveController.getConfig();
  }

  updateFlightSettings(partial: Partial<FlightSettingsConfig>): void {
    this.flightSettings = mergeFlightSettings({
      ...this.flightSettings,
      ...partial,
    });
    this.moveController.applyConfig(partial);

    if (partial.linearDamping !== undefined) {
      this.spaceShipAggregate.body.setLinearDamping(partial.linearDamping);
    }
    if (partial.angularDamping !== undefined) {
      this.spaceShipAggregate.body.setAngularDamping(partial.angularDamping);
    }

    saveFlightSettings(this.flightSettings);
  }

  private async loadSpaceShip() {
    this.assetContainer = await SceneLoader.ImportMeshAsync(
      "",
      "./model/",
      "spaceShip.glb",
      this.scene
    );
  }

  /** Убираем лишние меши из GLB — иначе «призрак» модели может остаться в сцене. */
  private disposeUnusedImportMeshes(): void {
    for (const mesh of this.assetContainer.meshes) {
      if (mesh === this.spaceShipBox || mesh.isDisposed()) continue;
      mesh.dispose(false, true);
    }
    for (const transform of this.assetContainer.transformNodes) {
      if (transform.isDisposed()) continue;
      transform.dispose(false, true);
    }
  }

  /**
   * Сдвигаем вершины: центр геометрии в (0,0,0), без pivot-матрицы.
   */
  private centerMeshGeometry(mesh: Mesh): void {
    mesh.refreshBoundingInfo();
    const center = mesh.getBoundingInfo().boundingBox.center;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] -= center.x;
        positions[i + 1] -= center.y;
        positions[i + 2] -= center.z;
      }
      mesh.setVerticesData(VertexBuffer.PositionKind, positions);
      mesh.createNormals(true);
      mesh.refreshBoundingInfo();
    }

    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.rotationQuaternion = Quaternion.Identity();
    mesh.scaling.set(1, 1, 1);
    mesh.computeWorldMatrix(true);
  }

  setOnRestart(callback: (() => void) | null): void {
    this.onRestart = callback;
  }

  restartObserver() {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (
        kbInfo.event.code === "KeyR" &&
        kbInfo.type === KeyboardEventTypes.KEYUP &&
        !this.controlsLockChecker?.()
      ) {
        this.restartSpaceShip();
      }
    });
  }

  restartSpaceShip() {
    this.spaceShipAggregate.body.setLinearVelocity(new Vector3(0, 0, 0));
    this.spaceShipAggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    this.spaceShipAggregate.body.disablePreStep = false;
    this.spaceShipBox.position.set(0, 0, 0);
    if (!this.spaceShipBox.rotationQuaternion) {
      this.spaceShipBox.rotationQuaternion = Quaternion.Identity();
    } else {
      this.spaceShipBox.rotationQuaternion.set(0, 0, 0, 1);
    }
    this.spaceShipBox.rotation.set(0, 0, 0);
    this.spaceShipAggregate.body.setTargetTransform(
      this.spaceShipBox.position,
      this.spaceShipBox.rotationQuaternion
    );
    this.prevVelocity.set(0, 0, 0);
    this.impactSensorReady = false;
    this.wasMovementFrozen = false;
    this.impactGraceUntil = performance.now() + UNFREEZE_IMPACT_GRACE_MS;
    this.onRestart?.();
  }
}
