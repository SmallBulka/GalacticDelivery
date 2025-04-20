import {
  KeyboardEventTypes,
  Mesh,
  PhysicsAggregate,
  Scene,
  Vector3,
} from "@babylonjs/core";


export default class SpaceShipMoveController {
  private scene: Scene;
  private inputMap: { [key: string]: boolean } = {};
  private spaceShipAggregate: PhysicsAggregate;
  private spaceShipBox: Mesh;
  private deltaTime = 0;
  
  // Настройки движения
  private movement = {
    thrustPower: 300,
    rotationPower: 12,
    maxSpeed: 200,
    dampingFactor: 0.40, // Сопротивление движению
    rotationDamping: 0.2, // Сопротивление вращению
    maxAngularSpeed: 8,    // Ограничение скорости вращения
    linearDamping: 0.1,   // Сопротивление движению (меньше = более "космическое")
    angularDamping: 0.1    // Сопротивление вращению
  };

  constructor(scene: Scene, spaceShipAggregate: PhysicsAggregate, spaceShipBox: Mesh) {
    this.scene = scene;
    this.spaceShipAggregate = spaceShipAggregate;
    this.spaceShipBox = spaceShipBox;
    
    this.setupInput();
    this.setupPhysicsTweaks();
    this.scene.registerBeforeRender(this.update.bind(this));
  }

  private setupInput(): void {
    // Отслеживание нажатий клавиш
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if ([KeyboardEventTypes.KEYDOWN, KeyboardEventTypes.KEYUP].includes(kbInfo.type)) {
        this.inputMap[kbInfo.event.code] = kbInfo.type === KeyboardEventTypes.KEYDOWN;
      }
    });
  }

  private setupPhysicsTweaks(): void {
    // Настройка физического тела для более "космического" поведения
    const body = this.spaceShipAggregate.body;
    body.setMassProperties({
      inertia: new Vector3(2, 2, 2), // Большая инерция при вращении
      mass: 1
    });
    body.setLinearDamping(0.1); // Небольшое линейное сопротивление
    body.setAngularDamping(0.2); // Небольшое угловое сопротивление
  }

  private update(): void {
    this.deltaTime = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.033);    
    // Применяем силы только если клавиши нажаты
    this.handleMovement();
    this.handleRotation();
    
    // Ограничение максимальной скорости
    // this.limitVelocity();
  }

  private handleMovement(): void {
    const body = this.spaceShipAggregate.body;
    const direction = new Vector3();
    
    if (this.inputMap["KeyW"]) {
      direction.addInPlace(this.spaceShipBox.getDirection(Vector3.Forward()));
    }
    if (this.inputMap["KeyS"]) {
      direction.addInPlace(this.spaceShipBox.getDirection(Vector3.Backward()));
    }
    if (this.inputMap["KeyA"]) {
      direction.addInPlace(this.spaceShipBox.getDirection(Vector3.Left()));
    }
    if (this.inputMap["KeyD"]) {
      direction.addInPlace(this.spaceShipBox.getDirection(Vector3.Right()));
    }
    if (this.inputMap["Space"]) {
      direction.addInPlace(this.spaceShipBox.getDirection(Vector3.Up()));
    }
    if (this.inputMap["KeyC"]) {
      direction.addInPlace(this.spaceShipBox.getDirection(Vector3.Down()));
    }

    if (direction.length() > 0) {
      direction.normalize();
      const force = direction.scale(this.movement.thrustPower * this.deltaTime);
      body.applyForce(force, body.getBoundingBox().centerWorld);
    }
  }

  private handleRotation(): void {
    const body = this.spaceShipAggregate.body;
    const angularVelocity = body.getAngularVelocity();
    const rotationChange = new Vector3();
    
    // Альтернативный способ управления вращением
    if (this.inputMap["ArrowUp"]) rotationChange.x -= this.movement.rotationPower * this.deltaTime;
    if (this.inputMap["ArrowDown"]) rotationChange.x += this.movement.rotationPower * this.deltaTime;
    if (this.inputMap["ArrowLeft"]) rotationChange.y -= this.movement.rotationPower * this.deltaTime;
    if (this.inputMap["ArrowRight"]) rotationChange.y += this.movement.rotationPower * this.deltaTime;

    if (rotationChange.lengthSquared() > 0) {
      // Применяем вращение через изменение угловой скорости
      const newAngularVelocity = angularVelocity.add(rotationChange);
      body.setAngularVelocity(new Vector3(
        Math.max(-this.movement.maxAngularSpeed, Math.min(this.movement.maxAngularSpeed, newAngularVelocity.x)),
        Math.max(-this.movement.maxAngularSpeed, Math.min(this.movement.maxAngularSpeed, newAngularVelocity.y)),
        angularVelocity.z
      ));
    } else {
      // Плавное замедление при отсутствии ввода
      body.setAngularVelocity(angularVelocity.scale(0.95));
    }
  }

  private limitVelocities(): void {
    const body = this.spaceShipAggregate.body;
    const velocity = body.getLinearVelocity();
    
    if (velocity.length() > this.movement.maxSpeed) {
      body.setLinearVelocity(velocity.normalize().scale(this.movement.maxSpeed));
    }
  }

  public emergencyStop(): void {
    const body = this.spaceShipAggregate.body;
    body.setLinearVelocity(Vector3.Zero());
    body.setAngularVelocity(Vector3.Zero());
  }
}

// export default class SpaceShipMoveController {
//   private scene: Scene;
//   keyObserver: Observer<KeyboardInfo>;
//   private spaceShipAggregate: PhysicsAggregate;
//   spaceShipBox: Mesh;
//   transformNode: TransformNode;
//   deltaTime = 0;
//   constructor(
//     scene: Scene,
//     spaceShipAggregate: PhysicsAggregate,
//     spaceShipBox: Mesh
//   ) {
//     this.scene = scene;
//     this.setKeyObserver();
//     this.spaceShipAggregate = spaceShipAggregate;
//     this.spaceShipBox = spaceShipBox;
//     this.scene.registerBeforeRender(() => {
//       this.deltaTime = (this.scene.getEngine() as any).getDeltaTime() / 1000;
//     });
//   }

//   private setKeyObserver(): void {
//     this.keyObserver = this.scene.onKeyboardObservable.add((kb) => {
//       const forceStrength = 300000 * this.deltaTime; // Сила постоянного воздействия
//       const angularVelocity = 100 * this.deltaTime; 
//       if (kb.event.code === "KeyW") {
//         this.spaceShipAggregate.body.applyForce(
//           this.spaceShipBox
//             .getDirection(Vector3.Forward())
//             .scale(forceStrength),
//           this.spaceShipAggregate.body.getBoundingBox().centerWorld
//         );
//         //  const line = MeshBuilder.CreateLines("line", { points: [new Vector3(0, 10, 0), new Vector3(0, 0, 0)] }, this.scene);
//         // line.setParent(this.spaceShipBox)
//       }
//       if ( kb.event.code === "KeyS") {
//         this.spaceShipAggregate.body.applyForce(
//           this.spaceShipBox
//             .getDirection(Vector3.Backward())
//             .scale(forceStrength),
//           this.spaceShipAggregate.body.getBoundingBox().centerWorld
//         );
//       }
//       if ( kb.event.code === "KeyA") {
//         this.spaceShipAggregate.body.applyForce(
//           this.spaceShipBox.getDirection(Vector3.Left()).scale(forceStrength),
//           this.spaceShipAggregate.body.getBoundingBox().centerWorld
//         );
//       }
//       if ( kb.event.code === "KeyD") {
//         this.spaceShipAggregate.body.applyForce(
//           this.spaceShipBox.getDirection(Vector3.Right()).scale(forceStrength),
//           this.spaceShipAggregate.body.getBoundingBox().centerWorld
//         );
//       }
//       if ( kb.event.code === "KeyC") {
//         this.spaceShipAggregate.body.applyForce(
//           this.spaceShipBox.getDirection(Vector3.Down()).scale(forceStrength),
//           this.spaceShipAggregate.body.getBoundingBox().centerWorld
//         );
//       }

//       if ( kb.event.code === "Space") {
//         this.spaceShipAggregate.body.applyForce(
//           this.spaceShipBox.getDirection(Vector3.Up()).scale(forceStrength),
//           this.spaceShipAggregate.body.getBoundingBox().centerWorld
//         );
//       }
//       if (
//         kb.type === KeyboardEventTypes.KEYUP &&
//         kb.event.code === "Digit1"
//       ) {
//         console.log("first")
//         this.spaceShipAggregate.body.setAngularVelocity(Vector3.Zero());
//       }if (
//         kb.type === KeyboardEventTypes.KEYUP &&
//         kb.event.code === "Digit2"
//       ) {
//         console.log("sec")
//         this.spaceShipAggregate.body.setLinearVelocity(Vector3.Zero());
//       }
//       if (kb.type === KeyboardEventTypes.KEYDOWN && kb.event.code === "KeyR") {
//         this.spaceShipAggregate.body.disablePreStep = false;
//         this.spaceShipAggregate.body.setLinearVelocity(new Vector3(0, 0, 0));
//         this.spaceShipAggregate.body.setAngularVelocity(new Vector3(0, 0, 0));
//         this.spaceShipAggregate.transformNode.position = new Vector3(0, 0, 0);
//         this.spaceShipAggregate.transformNode.rotation = new Vector3(0, 0, 0);
//         this.scene.onAfterPhysicsObservable.addOnce(() => {
//           this.spaceShipAggregate.body.disablePreStep = true;
//         });
//       }
//       if(kb.event.code === "ArrowRight"){
//         this.spaceShipAggregate.body.applyAngularImpulse(new Vector3(0, 1, 0).scale(angularVelocity))
//       }
//       if(kb.event.code === "ArrowLeft"){
//         this.spaceShipAggregate.body.applyAngularImpulse(new Vector3(0, -1, 0).scale(angularVelocity))
//       }
//       if (kb.event.code === "ArrowUp") {
//         this.spaceShipAggregate.body.applyAngularImpulse(new Vector3(-1, 0, 0).scale(angularVelocity))
//       }
//       if (kb.event.code === "ArrowDown") {
//         this.spaceShipAggregate.body.applyAngularImpulse(new Vector3(1, 0, 0).scale(angularVelocity))
//       }
//       // if (kb.type === KeyboardEventTypes.KEYUP && kb.event.code === "KeyW") {
//       //   this.spaceShipAggregate.body.applyForce(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
//       // }
//       // if (kb.type === KeyboardEventTypes.KEYUP && kb.event.code === "KeyS") {
//       //   this.spaceShipAggregate.body.applyForce(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
//       // }
//       // if (kb.type === KeyboardEventTypes.KEYUP && kb.event.code === "KeyA") {
//       //   this.spaceShipAggregate.body.applyForce(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
//       // }
//       // if (kb.type === KeyboardEventTypes.KEYUP && kb.event.code === "KeyD") {
//       //   this.spaceShipAggregate.body.applyForce(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
//       // }
//     });

//     //forward - backwards movement
//   }
// }
