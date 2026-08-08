import {
  KeyboardEventTypes,
  Mesh,
  PhysicsAggregate,
  Scene,
  Vector3,
  UniversalCamera,
} from "@babylonjs/core";

export enum ControlMode {
  ARCADE = "arcade", // Движение относительно камеры, мышь для вращения
  SIMULATOR = "simulator", // Реалистичное управление
}

export interface ShipControlsConfig {
  mode: ControlMode;
  thrustPower: number;
  rotationSpeed: number;
  maxSpeed: number;
  boostMultiplier: number;
  linearDamping: number;
  angularDamping: number;
}

export default class SpaceShipMoveControllerImproved {
  private scene: Scene;
  private spaceShipAggregate: PhysicsAggregate;
  private spaceShipBox: Mesh;
  private camera: UniversalCamera;
  private deltaTime = 0;
  
  private inputMap: { [key: string]: boolean } = {};
  
  private config: ShipControlsConfig = {
    mode: ControlMode.ARCADE,
    thrustPower: 500,
    rotationSpeed: 2.5,
    maxSpeed: 150,
    boostMultiplier: 2.0,
    linearDamping: 0.98, // Более сильное затухание для контроля
    angularDamping: 0.95,
  };

  constructor(
    scene: Scene,
    spaceShipAggregate: PhysicsAggregate,
    spaceShipBox: Mesh,
    camera: UniversalCamera,
    config?: Partial<ShipControlsConfig>
  ) {
    this.scene = scene;
    this.spaceShipAggregate = spaceShipAggregate;
    this.spaceShipBox = spaceShipBox;
    this.camera = camera;
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.setupInput();
    this.setupPhysics();
    this.scene.registerBeforeRender(this.update.bind(this));
  }

  private setupInput(): void {
    // Клавиатура
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if ([KeyboardEventTypes.KEYDOWN, KeyboardEventTypes.KEYUP].includes(kbInfo.type)) {
        this.inputMap[kbInfo.event.code] = kbInfo.type === KeyboardEventTypes.KEYDOWN;
      }
    });

    // Мышь для вращения (только в ARCADE режиме)
    if (this.config.mode === ControlMode.ARCADE) {
      this.scene.onBeforeRenderObservable.add(() => {
        // Получаем движение мыши от камеры
        if (this.camera.inputs) {
          // ArcRotateCamera хранит вращение в alpha/beta
          const arcCamera = this.camera as any;
          if (arcCamera.alpha !== undefined && arcCamera.beta !== undefined) {
            // Используем изменение углов камеры для вращения корабля
          }
        }
      });
    }
  }

  private setupPhysics(): void {
    const body = this.spaceShipAggregate.body;
    body.setMassProperties({
      inertia: new Vector3(1, 1, 1),
      mass: 1,
    });
    body.setLinearDamping(1 - this.config.linearDamping);
    body.setAngularDamping(1 - this.config.angularDamping);
  }

  private update(): void {
    this.deltaTime = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.033);
    
    if (this.config.mode === ControlMode.ARCADE) {
      this.handleArcadeControls();
    } else {
      this.handleSimulatorControls();
    }
    
    this.limitVelocity();
  }

  private handleArcadeControls(): void {
    const body = this.spaceShipAggregate.body;
    const isBoosting = this.inputMap["ShiftLeft"] || this.inputMap["ShiftRight"];
    const thrustMultiplier = isBoosting ? this.config.boostMultiplier : 1;
    
    // Движение относительно направления камеры
    const cameraDirection = this.camera.getDirection(Vector3.Forward());
    const cameraRight = this.camera.getDirection(Vector3.Right());
    const cameraUp = this.camera.getDirection(Vector3.Up());
    
    const moveDirection = new Vector3();
    
    // WASD - движение в плоскости камеры
    if (this.inputMap["KeyW"]) {
      moveDirection.addInPlace(cameraDirection);
    }
    if (this.inputMap["KeyS"]) {
      moveDirection.subtractInPlace(cameraDirection);
    }
    if (this.inputMap["KeyA"]) {
      moveDirection.subtractInPlace(cameraRight);
    }
    if (this.inputMap["KeyD"]) {
      moveDirection.addInPlace(cameraRight);
    }
    if (this.inputMap["Space"]) {
      moveDirection.addInPlace(cameraUp);
    }
    if (this.inputMap["KeyC"]) {
      moveDirection.subtractInPlace(cameraUp);
    }
    
    // Применяем силу движения
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      const force = moveDirection.scale(
        this.config.thrustPower * thrustMultiplier * this.deltaTime
      );
      body.applyForce(force, body.getBoundingBox().centerWorld);
    }
    
    // Торможение
    if (this.inputMap["KeyX"]) {
      const currentVelocity = body.getLinearVelocity();
      const brakingForce = currentVelocity.scale(-2 * this.deltaTime);
      body.applyForce(brakingForce, body.getBoundingBox().centerWorld);
    }
    
    // Вращение корабля вслед за камерой (плавно)
    this.rotateShipTowardsCamera();
  }

  private handleSimulatorControls(): void {
    const body = this.spaceShipAggregate.body;
    const isBoosting = this.inputMap["ShiftLeft"] || this.inputMap["ShiftRight"];
    const thrustMultiplier = isBoosting ? this.config.boostMultiplier : 1;
    
    // Движение относительно направления корабля
    const shipForward = this.spaceShipBox.getDirection(Vector3.Forward());
    const shipRight = this.spaceShipBox.getDirection(Vector3.Right());
    const shipUp = this.spaceShipBox.getDirection(Vector3.Up());
    
    const moveDirection = new Vector3();
    
    // W/S - вперед/назад по направлению корабля
    if (this.inputMap["KeyW"]) {
      moveDirection.addInPlace(shipForward);
    }
    if (this.inputMap["KeyS"]) {
      moveDirection.subtractInPlace(shipForward);
    }
    
    // A/D - стрейф влево/вправо
    if (this.inputMap["KeyA"]) {
      moveDirection.subtractInPlace(shipRight);
    }
    if (this.inputMap["KeyD"]) {
      moveDirection.addInPlace(shipRight);
    }
    
    // Space/C - вверх/вниз
    if (this.inputMap["Space"]) {
      moveDirection.addInPlace(shipUp);
    }
    if (this.inputMap["KeyC"]) {
      moveDirection.subtractInPlace(shipUp);
    }
    
    // Применяем силу движения
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      const force = moveDirection.scale(
        this.config.thrustPower * thrustMultiplier * this.deltaTime
      );
      body.applyForce(force, body.getBoundingBox().centerWorld);
    }
    
    // Вращение через угловую скорость
    const rotationChange = new Vector3();
    
    // Стрелки/мышь для pitch/yaw
    if (this.inputMap["ArrowUp"]) rotationChange.x -= this.config.rotationSpeed * this.deltaTime;
    if (this.inputMap["ArrowDown"]) rotationChange.x += this.config.rotationSpeed * this.deltaTime;
    if (this.inputMap["ArrowLeft"]) rotationChange.y -= this.config.rotationSpeed * this.deltaTime;
    if (this.inputMap["ArrowRight"]) rotationChange.y += this.config.rotationSpeed * this.deltaTime;
    
    // Q/E для крена (roll)
    if (this.inputMap["KeyQ"]) rotationChange.z -= this.config.rotationSpeed * this.deltaTime;
    if (this.inputMap["KeyE"]) rotationChange.z += this.config.rotationSpeed * this.deltaTime;
    
    if (rotationChange.lengthSquared() > 0) {
      const currentAngularVel = body.getAngularVelocity();
      const newAngularVel = currentAngularVel.add(rotationChange);
      body.setAngularVelocity(newAngularVel);
    }
    
    // Торможение
    if (this.inputMap["KeyX"]) {
      const currentVelocity = body.getLinearVelocity();
      const brakingForce = currentVelocity.scale(-2 * this.deltaTime);
      body.applyForce(brakingForce, body.getBoundingBox().centerWorld);
    }
  }

  private rotateShipTowardsCamera(): void {
    // Плавно вращаем корабль в направлении камеры
    const cameraDirection = this.camera.getDirection(Vector3.Forward());
    
    // Вычисляем желаемое вращение
    const targetRotation = this.getRotationFromDirection(cameraDirection);
    const currentRotation = this.spaceShipBox.rotation;
    
    // Интерполяция для плавности
    const lerpFactor = 3 * this.deltaTime;
    const newRotation = Vector3.Lerp(currentRotation, targetRotation, lerpFactor);
    
    // Применяем вращение через угловую скорость
    const rotationDelta = newRotation.subtract(currentRotation).scale(10);
    this.spaceShipAggregate.body.setAngularVelocity(rotationDelta);
  }

  private getRotationFromDirection(direction: Vector3): Vector3 {
    // Простой способ получить вращение из направления
    const rotation = new Vector3();
    rotation.y = Math.atan2(direction.x, direction.z);
    rotation.x = Math.asin(direction.y);
    return rotation;
  }

  private limitVelocity(): void {
    const body = this.spaceShipAggregate.body;
    const velocity = body.getLinearVelocity();
    const isBoosting = this.inputMap["ShiftLeft"] || this.inputMap["ShiftRight"];
    const currentMaxSpeed = isBoosting 
      ? this.config.maxSpeed * this.config.boostMultiplier 
      : this.config.maxSpeed;
    
    if (velocity.length() > currentMaxSpeed) {
      body.setLinearVelocity(velocity.normalize().scale(currentMaxSpeed));
    }
  }

  public emergencyStop(): void {
    const body = this.spaceShipAggregate.body;
    body.setLinearVelocity(Vector3.Zero());
    body.setAngularVelocity(Vector3.Zero());
  }

  public setMode(mode: ControlMode): void {
    this.config.mode = mode;
  }

  public dispose(): void {
    // Очистка подписок
  }
}
