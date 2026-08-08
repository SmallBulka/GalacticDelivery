import { Mesh, PhysicsAggregate, PhysicsBody, Scene, Vector3 } from "@babylonjs/core";
import { IInputState } from "./IInputState";


const MAX_SPEED = 60;

/**  быстро набирается скорость до MAX_SPEED (единиц/с²) */
const THRUST_ACCELERATION = 10;
const ROTATION_SPEED = 0.5;
const ANGULAR_DAMPING = 0.95;
const MAX_DELTA = 0.033;

export default class SpaceShipMovementController {
  private deltaTime = 0;

  constructor(
    private scene: Scene,
    private spaceShipAggregate: PhysicsAggregate,
    private spaceShipBox: Mesh,
    private getInput: () => IInputState
  ) {
    this.scene.onBeforePhysicsObservable.add(() => {
      this.deltaTime = Math.min(
        this.scene.getEngine().getDeltaTime() / 1000,
        MAX_DELTA
      );
      this.update(this.getInput());
    });
  }

  private update(input: IInputState): void {
    const body = this.spaceShipAggregate.body;

    this.applyThrust(body, input.thrust);
    this.applyRotation(body, input);
    this.clampSpeed(body);
  }

  /**
   * W/S — разгон к ±MAX_SPEED.
   * Скорость задаётся напрямую через MAX_SPEED, а THRUST_ACCELERATION — скорость разгона.
   */
  private applyThrust(body: PhysicsBody, thrust: number): void {
    if (thrust === 0) return;

    const forward = this.spaceShipBox.getDirection(Vector3.Forward());
    const velocity = body.getLinearVelocity();
    const forwardSpeed = Vector3.Dot(velocity, forward);
    const targetSpeed = thrust * MAX_SPEED;

    const speedDelta = targetSpeed - forwardSpeed;
    const step = THRUST_ACCELERATION * this.deltaTime;
    const newForwardSpeed =
      forwardSpeed + Math.sign(speedDelta) * Math.min(Math.abs(speedDelta), step);

    const lateral = velocity.subtract(forward.scale(forwardSpeed));
    body.setLinearVelocity(lateral.add(forward.scale(newForwardSpeed)));
  }

  /** A/D — рысканье, стрелки — тангаж и крен */
  private applyRotation(body: PhysicsBody, input: IInputState): void {
    const rotating = input.yaw !== 0 || input.pitch !== 0 || input.roll !== 0;

    if (!rotating) {
      body.setAngularVelocity(
        body.getAngularVelocity().scale(ANGULAR_DAMPING)
      );
      return;
    }

    const right = this.spaceShipBox.getDirection(Vector3.Right());
    const forward = this.spaceShipBox.getDirection(Vector3.Forward());
    const up = this.spaceShipBox.getDirection(Vector3.Up());

    const angularVelocity = right
      .scale(-input.pitch * ROTATION_SPEED)
      .add(forward.scale(-input.roll * ROTATION_SPEED))
      .add(up.scale(input.yaw * ROTATION_SPEED));

    body.setAngularVelocity(angularVelocity);
  }

  private clampSpeed(body: PhysicsBody): void {
    const velocity = body.getLinearVelocity();
    const speed = velocity.length();

    if (speed > MAX_SPEED) {
      body.setLinearVelocity(velocity.normalize().scale(MAX_SPEED));
    }
  }
}

export { MAX_SPEED, THRUST_ACCELERATION };
