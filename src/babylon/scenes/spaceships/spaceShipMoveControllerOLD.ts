// import {
//   ActionManager,
//   ExecuteCodeAction,
//   Scalar,
//   Scene,
// } from "@babylonjs/core";

// export default class SpaceShipMoveController {
//   private scene: Scene;
//   public inputMap: { [key: string]: boolean };
  

//   //simple movement
//   public horizontal: number = 0;
//   public vertical: number = 0;
//   //tracks whether or not there is movement in that axis
//   public horizontalAxis: number = 0;
//   public verticalAxis: number = 0;

//   //jumping and dashing
//   public jumpKeyDown: boolean = false;
//   public dashing: boolean = false;

//   constructor(scene: Scene) {
//     scene.actionManager = new ActionManager(scene);

//     this.inputMap = {};
//     scene.actionManager.registerAction(
//       new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
//         this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
//       })
//     );
//     scene.actionManager.registerAction(
//       new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
//         this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
//       })
//     );

//     scene.onBeforeRenderObservable.add(() => {
//       this._updateFromKeyboard();
//     });
//   }

//   //forward - backwards movement
//   private _updateFromKeyboard(): void {
//     if (this.inputMap["ArrowUp"]) {
//       this.vertical = Scalar.Lerp(this.vertical, 1, 0.2);
//       this.verticalAxis = 1;
//     } else if (this.inputMap["ArrowDown"]) {
//       this.vertical = Scalar.Lerp(this.vertical, -1, 0.2);
//       this.verticalAxis = -1;
//     } else {
//       this.vertical = 0;
//       this.verticalAxis = 0;
//     }

//     if (this.inputMap["ArrowLeft"]) {
//       this.horizontal = Scalar.Lerp(this.horizontal, -1, 0.2);
//       this.horizontalAxis = -1;
//     } else if (this.inputMap["ArrowRight"]) {
//       this.horizontal = Scalar.Lerp(this.horizontal, 1, 0.2);
//       this.horizontalAxis = 1;
//     } else {
//       this.horizontal = 0;
//       this.horizontalAxis = 0;
//     }
//   }
// }




// private setKeyObserver(): void {
//     this.keyObserver = this.scene.onKeyboardObservable.add((kb) => {
//       const impulseStrength = 10; // Сила импульса
//     const forceStrength = 1;    // Сила постоянного воздействия
//       if (kb.type === KeyboardEventTypes.KEYDOWN) {
//         this.spaceShipAggregate.body.applyImpulse(new Vector3(0,5, 0), new Vector3(0, 0, 0));
//       //  const line = MeshBuilder.CreateLines("line", { points: [new Vector3(0, 10, 0), new Vector3(0, 0, 0)] }, this.scene);
//       // line.setParent(this.spaceShipBox)
//       }
//       if (kb.type === KeyboardEventTypes.KEYUP && kb.event.code === "KeyS") {
//         this.spaceShipAggregate.body.applyImpulse(new Vector3(0,-10, 0), new Vector3(0, 0, 0));
//       }
//       if (kb.type === KeyboardEventTypes.KEYUP && kb.event.code === "KeyA") {
//         this.spaceShipAggregate.body.applyImpulse(new Vector3(0,-10, 0), new Vector3(0, 0, 0));
//       }
//       if (kb.type === KeyboardEventTypes.KEYUP && kb.event.code === "KeyD") {
//         this.spaceShipAggregate.body.applyImpulse(new Vector3(0,-10, 0), new Vector3(0, 0, 0));
//       }
//       if (kb.type === KeyboardEventTypes.KEYUP && kb.event.code === "KeyR") {
//         this.spaceShipAggregate.body.disablePreStep=false
//         this.spaceShipAggregate.body.setLinearVelocity(new Vector3(0, 0, 0));
//         this.spaceShipAggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
//         this.spaceShipAggregate.transformNode.position = new Vector3(0, 0, 0);
//         this.spaceShipAggregate.transformNode.rotation = new Vector3(0, 0, 0);
//         this.scene.onAfterPhysicsObservable.addOnce(() => {
//           this.spaceShipAggregate.body.disablePreStep=true
//         })
//       }
//     });