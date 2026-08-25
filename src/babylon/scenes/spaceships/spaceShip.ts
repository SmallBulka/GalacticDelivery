import {
  ISceneLoaderAsyncResult,
  KeyboardEventTypes,
  Mesh,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import KeyboardController from "./KeyboardController";
import SpaceShipMovementController from "./spaceShipMovementController";
import {
  FlightSettingsConfig,
  mergeFlightSettings,
} from "./FlightSettingsConfig";
import { GamepadInputProvider } from "./GamepadInputProvider";
import { CompositeInputProvider } from "./CompositeInputProvider";
import { IInputProvider } from "./IInputProvider";
import { IInputState } from "./IInputState";

export default class SpaceShip {
  private scene: Scene;
  private moveController!: SpaceShipMovementController;
  private assetContainer!: ISceneLoaderAsyncResult;
  public spaceShipBox!: Mesh;
  private spaceShipNode!: TransformNode;
  public spaceShipAggregate!: PhysicsAggregate;
  private flightSettings: FlightSettingsConfig;
  private inputProvider!: IInputProvider;
  private keyboardController!: KeyboardController;
  private gamepadInput!: GamepadInputProvider;
  /** Множитель тяги от заряда энергии (0 — нет топлива). */
  private thrustMultiplier = 1;

  constructor(scene: Scene, flightSettings?: Partial<FlightSettingsConfig>) {
    this.scene = scene;
    this.flightSettings = mergeFlightSettings(flightSettings);
  }

  public async createSpaceShip() {
    await this.loadSpaceShip();

    this.spaceShipNode = new TransformNode("spaceShip", this.scene);
    this.assetContainer.meshes[1].rotate(Vector3.Left(), Math.PI / 2);
    this.assetContainer.meshes[2].rotate(Vector3.Left(), Math.PI / 2);
    this.assetContainer.meshes[1].parent = this.spaceShipNode;
    this.assetContainer.meshes[2].parent = this.spaceShipNode;

    const mergedMesh = Mesh.MergeMeshes(
      [
        this.assetContainer.meshes[1] as Mesh,
        this.assetContainer.meshes[2] as Mesh,
      ],
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
    this.spaceShipAggregate = new PhysicsAggregate(
      this.spaceShipBox,
      PhysicsShapeType.BOX,
      { mass: 10 },
      this.scene
    );

    this.spaceShipBox.setPivotPoint(
      this.spaceShipAggregate.body.getBoundingBox().centerWorld
    );
    this.spaceShipAggregate.body.setLinearDamping(
      this.flightSettings.linearDamping
    );
    this.spaceShipAggregate.body.setAngularDamping(
      this.flightSettings.angularDamping
    );

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
    this.restartObserver();
  }

  setThrustMultiplier(multiplier: number): void {
    this.thrustMultiplier = Math.max(0, Math.min(1, multiplier));
  }

  /** Актуальный объединённый ввод (клавиатура + геймпад) для камеры и UI. */
  getInput(): IInputState {
    return this.getThrottledInput();
  }

  private getThrottledInput(): IInputState {
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
  }

  private async loadSpaceShip() {
    this.assetContainer = await SceneLoader.ImportMeshAsync(
      "",
      "./model/",
      "car.glb",
      this.scene
    );
  }

  restartObserver() {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (
        kbInfo.event.code === "KeyR" &&
        kbInfo.type === KeyboardEventTypes.KEYUP
      ) {
        this.restartSpaceShip();
      }
    });
  }

  restartSpaceShip() {
    this.spaceShipAggregate.body.setLinearVelocity(new Vector3(0, 0, 0));
    this.spaceShipAggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
    this.spaceShipAggregate.body.disablePreStep = false;
    this.spaceShipBox.position = new Vector3(0, 0, 0);
    this.spaceShipBox.rotation = new Vector3(0, 0, 0);
    if (this.spaceShipBox.rotationQuaternion) {
      this.spaceShipBox.rotationQuaternion.set(0, 0, 0, 1);
    }
  }
}
