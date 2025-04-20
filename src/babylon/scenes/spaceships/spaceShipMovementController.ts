import {
  Mesh,
  PhysicsAggregate,
  Scene,
  Vector3,
} from "@babylonjs/core";
import KeyboardControllerEvent from "./KeyboardControllerEvent";
enum Direction {
  left = "1",
  right = "2",
  forward = "3",
  back = "4",
  leftroll = "5",
  rightroll = "6",
}
export default class SpaceShipMovementController {
  private scene: Scene;
  private inputMap: { [key: string]: boolean } = {};
  private spaceShipAggregate: PhysicsAggregate;
  private spaceShipBox: Mesh;
  private deltaTime = 0;
  private keyboardControllerEvent: KeyboardControllerEvent;
  private speed = 200;
  private rotateSpeed = 20;

  constructor(
    scene: Scene,
    spaceShipAggregate: PhysicsAggregate,
    spaceShipBox: Mesh
  ) {
    this.scene = scene;
    this.spaceShipAggregate = spaceShipAggregate;
    this.spaceShipBox = spaceShipBox;
    this.keyboardControllerEvent = new KeyboardControllerEvent(scene);
    this.scene.onBeforePhysicsObservable.add(() => {
      this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
      this.keyboardControl();
    });
  }
  public async keyboardControl() {
    if (this.keyboardControllerEvent.rotateLeft) {
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Left()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Forward())
        )
      );
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Right()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Backward())
        )
      );
      // this.spaceShipBox.rotate(Vector3.Up(), Math.PI * this.deltaTime);
    }
    if (this.keyboardControllerEvent.rotateRight) {
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Right()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Forward())
        )

      );
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Left()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Backward())
        )
      );
      // this.spaceShipBox.rotate(Vector3.Up(), -Math.PI * this.deltaTime);
    }

    if (this.keyboardControllerEvent.left) {
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Left()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Up())
        )
      );
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Right()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Down())
        )
      );
      // this.spaceShipBox.rotate(Vector3.Forward(), Math.PI * this.deltaTime);
    }
    if (this.keyboardControllerEvent.right) {
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Right()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Up())
        )
      );
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Left()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Down())
        )
      );
      // this.spaceShipBox.rotate(Vector3.Forward(), -Math.PI * this.deltaTime);
    }

    if (this.keyboardControllerEvent.forward) {
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Down()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Forward())
        )
      );
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Up()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Backward())
        )
      );
      // this.spaceShipBox.rotate(Vector3.Right(), Math.PI * this.deltaTime);
    }
    if (this.keyboardControllerEvent.back) {
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Up()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Forward())
        )
      );
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Down()).scale(this.rotateSpeed),
        this.spaceShipBox.position.add(
          this.spaceShipBox.getDirection(Vector3.Backward())
        )
      );
      // this.spaceShipBox.rotate(Vector3.Right(), -Math.PI * this.deltaTime);
    }
    if (this.keyboardControllerEvent.up) {
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Forward()).scale(this.speed),
        this.spaceShipAggregate.body.getBoundingBox().centerWorld
      );
    }
    if (this.keyboardControllerEvent.down) {
      this.spaceShipAggregate.body.applyForce(
        this.spaceShipBox.getDirection(Vector3.Backward()).scale(this.speed),
        this.spaceShipAggregate.body.getBoundingBox().centerWorld
      );
    }
  }
}
