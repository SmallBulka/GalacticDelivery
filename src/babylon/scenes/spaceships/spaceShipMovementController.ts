import { PhysicsAggregate, PhysicsBody, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { IInputState } from "./IInputState";
import {
  FlightSettingsConfig,
  mergeFlightSettings,
} from "./FlightSettingsConfig";

const MAX_DELTA = 0.033;

export default class SpaceShipMovementController {
  private deltaTime = 0;
  private config: FlightSettingsConfig;

  constructor(
    private scene: Scene,
    private spaceShipAggregate: PhysicsAggregate,
    private shipTransform: TransformNode,
    private getInput: () => IInputState,
    config?: Partial<FlightSettingsConfig>
  ) {
    this.config = mergeFlightSettings(config);

    this.scene.onBeforePhysicsObservable.add(() => {
      this.deltaTime = Math.min(
        this.scene.getEngine().getDeltaTime() / 1000,
        MAX_DELTA
      );
      this.update(this.getInput());
    });
  }

  getConfig(): FlightSettingsConfig {
    return { ...this.config };
  }

  applyConfig(partial: Partial<FlightSettingsConfig>): void {
    this.config = mergeFlightSettings({ ...this.config, ...partial });
  }

  private update(input: IInputState): void {
    const body = this.spaceShipAggregate.body;

    this.applyThrust(body, input.thrust);
    this.applyRotation(body, input);
    this.clampSpeed(body);
  }

  private applyThrust(body: PhysicsBody, thrust: number): void {
    if (thrust === 0) return;

    const forward = this.shipTransform.getDirection(Vector3.Forward());
    const velocity = body.getLinearVelocity();
    const forwardSpeed = Vector3.Dot(velocity, forward);
    const targetSpeed = thrust * this.config.maxSpeed;

    const speedDelta = targetSpeed - forwardSpeed;
    const step = this.config.thrustAcceleration * this.deltaTime;
    const newForwardSpeed =
      forwardSpeed + Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), step);

    const lateral = velocity.subtract(forward.scale(forwardSpeed));
    body.setLinearVelocity(lateral.add(forward.scale(newForwardSpeed)));
  }

  private applyRotation(body: PhysicsBody, input: IInputState): void {
    const right = this.shipTransform.getDirection(Vector3.Right());
    const forward = this.shipTransform.getDirection(Vector3.Forward());
    const up = this.shipTransform.getDirection(Vector3.Up());

    const angularVelocity = right
      .scale(-input.pitch * this.config.rotationSpeed)
      .add(forward.scale(-input.roll * this.config.rotationSpeed))
      .add(up.scale(input.yaw * this.config.rotationSpeed));

    body.setAngularVelocity(angularVelocity);
  }

  private clampSpeed(body: PhysicsBody): void {
    const velocity = body.getLinearVelocity();
    const speed = velocity.length();

    if (speed > this.config.maxSpeed) {
      body.setLinearVelocity(velocity.normalize().scale(this.config.maxSpeed));
    }
  }
}
