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
import SpaceShipMovementController from "./spaceShipMovementController";

export default class SpaceShip {
  private scene: Scene;
 moveController!: SpaceShipMovementController;
  private assetContainer!: ISceneLoaderAsyncResult;
  public spaceShipBox!: Mesh;
  private spaceShipNode!: TransformNode;
  public spaceShipAggregate!: PhysicsAggregate;
  // private spaceShipCamera: UniversalCamera
  constructor(scene: Scene) {
    this.scene = scene;
  }
  public async createSpaceShip() {
    await this.loadSpaceShip();

    this.spaceShipNode = new TransformNode("spaceShip", this.scene);
    this.assetContainer.meshes[1].rotate(Vector3.Left(), Math.PI / 2);
    this.assetContainer.meshes[2].rotate(Vector3.Left(), Math.PI / 2);
    this.assetContainer.meshes[1].parent = this.spaceShipNode;
    this.assetContainer.meshes[2].parent = this.spaceShipNode;
    // this.spaceShipNode.position.y = 20;
    this.spaceShipBox = Mesh.MergeMeshes(
      [
        this.assetContainer.meshes[1] as Mesh,
        this.assetContainer.meshes[2] as Mesh,
      ],
      true,
      true,
      undefined,
      false,
      true
    ) as Mesh;
    this.spaceShipAggregate = await new PhysicsAggregate(
      this.spaceShipBox,
      PhysicsShapeType.BOX,
      { mass: 10 },
      this.scene
    );

    this.spaceShipBox.setPivotPoint(
      this.spaceShipAggregate.body.getBoundingBox().centerWorld
    );
    this.spaceShipAggregate.body.setLinearDamping(0.8);
    this.spaceShipAggregate.body.setAngularDamping(0.8);

    // setInterval(() => {
    //   console.log(
    //     "spaceShipBox",
    //     this.spaceShipBox.getBoundingInfo().boundingBox.centerWorld
    //   );
    //   console.log(
    //     "spaceShipAggregate",
    //     this.spaceShipAggregate.body.getBoundingBox().centerWorld
    //   );
    // }, 1000);

    this.moveController = new SpaceShipMovementController(
      this.scene,
      this.spaceShipAggregate,
      this.spaceShipBox
    );
    this.restartObserver();
    // this.initCamera()

    // this.spaceShipAggregate.body.applyForce(new Vector3(0, 0, 1), new Vector3(0, 0, 0));
    // const secAggregate = await new PhysicsAggregate(
    //   this.spaceShipNode.getChildMeshes()[1],
    //   PhysicsShapeType.BOX,
    //   { mass: 1 },
    //   this.scene
    // );

    // this.assetContainer.forEach((value, index, array) => {
    //     new PhysicsAggregate()
    // })
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
  }
  // initCamera() {
  //   this.spaceShipCamera = new UniversalCamera("spaceShipCamera", this.spaceShipBox.position , this.scene);

  //   this.spaceShipCamera.parent = this.spaceShipBox;
  //   this.spaceShipCamera.position = new Vector3(0, 10, -30);
  //   this.spaceShipCamera.setTarget(this.spaceShipBox.position);
  //   this.scene.activeCamera=this.spaceShipCamera

  // }
}
