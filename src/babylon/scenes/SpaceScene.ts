// src/babylon/PhysicsScene.ts
import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  HavokPlugin,
  StandardMaterial,
  Texture,
  Mesh,
  PointLight,
  Color3,
  ParticleSystem,
  CubeTexture,
  BackgroundMaterial,
} from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { GameUI } from "../gui/GameUI";
import { StatusLoadingScreen } from "../loading/StatusLoadingScreen";
import { SceneBootstrap } from "./SceneBootstrap";
import { Inspector } from "@babylonjs/inspector";
import "@babylonjs/loaders";
import SpaceShip from "./spaceships/spaceShip";
import AsteroidsController from "../asteroidsController";
import HK from "@babylonjs/havok";
import { CameraManager } from "./spaceships/CameraManager";
import { PlanetManager } from "../planets/PlanetManager";
import { QuestManager } from "../quests/QuestManager";
import { EMPTY_INPUT_STATE } from "./spaceships/IInputState";
import { WORLD_SIZE, WorldBounds } from "../world/WorldBounds";

export class SpaceScene {
  private engine: Engine;
  private scene: Scene;
  private cameraManager!: CameraManager;
  private ship!: SpaceShip;
  private planetManager!: PlanetManager;
  private questManager!: QuestManager;
  private hk!: HavokPlugin;
  private boxes: Mesh[] = [];
  private score: number = 0;
  private gameUI!: GameUI;
  private boxCount: number = 100;
  private collectDistance: number = 10;
  private deltaTime: number = 0;
  private nebulaParticles?: ParticleSystem;
  private advancedTexture?: AdvancedDynamicTexture;
  private havokInstance: any;
  private loadingScreen: StatusLoadingScreen;


  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);
    this.loadingScreen = new StatusLoadingScreen();
    this.engine.loadingScreen = this.loadingScreen;
    this.engine.displayLoadingUI();
    this.loadingScreen.setStatus("Инициализация физики...");

    void this.start();
  }

  private async start(): Promise<void> {
    try {
      this.loadingScreen.setStatus("Инициализация физики...");
      await this.initPhysics();

      this.loadingScreen.setStatus("Подготовка камеры и космоса...");
      this.createCamera();
      this.createLight();
      this.createSkybox();

      const bootstrap = new SceneBootstrap(
        (text) => this.loadingScreen.setStatus(text),
        {
          calculateDeltaTime: () => this.calculateDeltaTime(),
          createWorldBounds: () => this.createWorldBounds(),
          createShip: () => this.CreateShip(),
          createInitialPlanets: () => this.createInitialPlanets(),
          initGameUI: () => this.initGameUI(),
          initQuests: () => this.initQuests(),
          generateBoxes: () => this.generateBoxes(),
          updateChunks: () => this.updateChunks(),
          setupRenderHooks: () => this.setupRenderHooks(),
          initAsteroids: (onProgress) => this.initAsteroids(onProgress),
          applyGravity: () => this.appyGravity(),
          maybeShowInspector: () => this.maybeShowInspector(),
        }
      );
      await bootstrap.run();
    } catch (error) {
      console.error("Ошибка загрузки сцены:", error);
      this.loadingScreen.setStatus("Ошибка загрузки");
    } finally {
      this.engine.hideLoadingUI();
    }

    this.engine.runRenderLoop(() => {
      if (!this.havokInstance) {
        return;
      }
      this.scene.render();
    });
  }

  /** Камера до корабля: без target. Цель вешается в CreateShip. */
  private createCamera(): void {
    this.cameraManager = new CameraManager(this.scene, {
      followOffset: new Vector3(0, 4.5, -20),//(0, 2.5, -10)
      positionSmoothness: 6,
      rotationSmoothness: 4,
    });
  }

  private createLight(): void {
    new HemisphericLight("light1", new Vector3(1, 1, 0), this.scene);
    new PointLight("pointLight", new Vector3(100, 100, 100), this.scene);
  }

  private createSkybox(): void {
    const skyboxTexture = new CubeTexture(
      "./textures/skybox/space",
      this.scene,
      ["_px.png", "_py.png", "_pz.png", "_nx.png", "_ny.png", "_nz.png"]
    );

    const skybox = MeshBuilder.CreateBox("skyBox", { size: 8000 }, this.scene);
    const skyboxMaterial = new BackgroundMaterial("skyBoxMaterial", this.scene);
    skyboxMaterial.reflectionTexture = skyboxTexture;
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.backFaceCulling = false;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skybox.ignoreCameraMaxZ = true; 
    skybox.isPickable = false;

    this.scene.environmentTexture = skyboxTexture;
  }

  private createWorldBounds(): void {
    const bounds = new WorldBounds(this.scene, WORLD_SIZE);
    bounds.createWalls();
  }

  private async createInitialPlanets() {
    this.planetManager = new PlanetManager(this.scene, {
      worldSize: WORLD_SIZE,
    });
    this.planetManager.excludeFromGlow(this.ship.spaceShipBox);
    this.planetManager.createInitialPlanets(6);
  }

  private initQuests(): void {
    this.questManager = new QuestManager(
      this.scene,
      this.planetManager,
      this.gameUI.getQuestUIBundle(),
      () => this.ship?.spaceShipAggregate,
      () => this.ship.spaceShipBox.getAbsolutePosition(),
      () =>
        this.ship?.spaceShipAggregate?.body.getLinearVelocity().length() ?? 0,
      () => this.ship.spaceShipBox.getWorldMatrix(),
      (msg) => this.gameUI.showMessage(msg, 4000),
      (items) => this.gameUI.refreshQuestList(items)
    );
    this.questManager.initialize();
    this.gameUI.setQuestSelectHandler((id) =>
      this.questManager.selectQuest(id)
    );
  }

  private updateChunks() {
    if (!this.ship?.spaceShipBox || !this.planetManager) return;
    this.planetManager.updateChunks(this.ship.spaceShipBox.position);
  }
private async initPhysics(): Promise<void> {
  try {
    this.havokInstance = await HK();
    this.hk = await new HavokPlugin(true, this.havokInstance);
    await this.scene.enablePhysics(new Vector3(0, 0, 0), this.hk);
  } catch (error) {
    console.error("Failed to initialize Havok Physics:", error);
  }
}

  private async CreateShip() {
    this.ship = new SpaceShip(this.scene);
    await this.ship.createSpaceShip();
    this.ship.spaceShipBox.renderingGroupId = 1;
    this.scene.setRenderingAutoClearDepthStencil(1, false, false, false);
    this.cameraManager.attachTarget(this.ship.spaceShipBox);
  }

  private initGameUI(): void {
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
    this.gameUI = new GameUI(
      this.advancedTexture,
      (partial) => this.ship.updateFlightSettings(partial),
      () => this.ship.getFlightSettings()
    );
    this.gameUI.initialize();
    this.gameUI.bindKeyboardDisplay(
      this.scene,
      () => this.ship.getGamepadStickDisplay()
    );
  }

  private setupRenderHooks(): void {
    if (this.nebulaParticles && this.ship.spaceShipBox) {
      this.nebulaParticles.emitter = this.ship.spaceShipBox;
      this.nebulaParticles.start();
    }

    this.scene.registerBeforeRender(() => {
      const dt =
        this.deltaTime > 0
          ? this.deltaTime
          : this.scene.getEngine().getDeltaTime() / 1000;

      const input = this.ship ? this.ship.getInput() : EMPTY_INPUT_STATE;
      this.cameraManager.update(input, dt);

      this.updateChunks();
      this.updateBoxCollection();
      this.questManager?.update(dt);

      if (this.ship?.spaceShipAggregate) {
        const speed = this.ship.getSpeed();
        this.gameUI?.updateSpeedometer(
          speed,
          this.ship.getFlightSettings().maxSpeed
        );

        if (this.nebulaParticles) {
          this.nebulaParticles.emitRate = Math.min(200, speed * 2);

          if (speed > 0.1) {
            const velocity = this.ship.spaceShipAggregate.body.getLinearVelocity();
            const direction = velocity.normalize().scale(-1);
            this.nebulaParticles.direction1 = direction.scale(5);
            this.nebulaParticles.direction2 = direction.scale(5);
          }
        }
      }
    });
  }

  private async initAsteroids(
    onProgress: (done: number, total: number) => void
  ): Promise<void> {
    const asteroidsController = new AsteroidsController(this.scene, WORLD_SIZE);
    asteroidsController.excludeFromGlow(this.ship.spaceShipBox);
    await asteroidsController.initialize(onProgress);
  }

  private maybeShowInspector(): void {
    const params = new URLSearchParams(window.location.search);
    const debugFlag =
      params.get("debug") === "1" ||
      localStorage.getItem("debugInspector") === "1";
    if (debugFlag) {
      Inspector.Show(this.scene, {});
    }
  }

  private generateBoxes(): void {
    const areaSize = 1000; // Большая область для генерации
    
    for (let i = 0; i < this.boxCount; i++) {
      this.createBox(
        (Math.random() - 0.5) * areaSize,
        (Math.random() - 0.5) * areaSize,
        (Math.random() - 0.5) * areaSize
      );
    }
  }

  private createBox(x: number, y: number, z: number): void {
    const box = MeshBuilder.CreateBox(`box_${x}_${y}_${z}`, { size: 4 }, this.scene);
    box.position = new Vector3(x, y, z);
    
    // Материал с случайным цветом и свечением
    const boxMat = new StandardMaterial(`boxMat_${x}_${y}_${z}`, this.scene);
    boxMat.diffuseColor = new Color3(Math.random(), Math.random(), Math.random());
    boxMat.emissiveColor = boxMat.diffuseColor.scale(0.9);
    box.material = boxMat;
    
    // Вращение коробки
    box.rotation = new Vector3(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // // Физическое тело (статичное)
    // new PhysicsAggregate(
    //   box,
    //   PhysicsShapeType.BOX,
    //   { mass: 0, restitution: 0 },
    //   this.scene
    // );

    this.boxes.push(box);
  }

private updateBoxCollection(): void {
  if (!this.ship?.spaceShipBox || this.boxes.length === 0) return;
  
  const shipPos = this.ship.spaceShipBox.position;
  const sqrCollectDistance = this.collectDistance * this.collectDistance; 
  
  for (let i = this.boxes.length - 1; i >= 0; i--) {
      const box = this.boxes[i];
      
      if (Vector3.DistanceSquared(shipPos, box.position) < sqrCollectDistance) {

          if (box.dispose) box.dispose();
          if (box.physicsBody) box.physicsBody.dispose();
          
          this.boxes.splice(i, 1);
          this.score++;
          

          this.gameUI.updateScore(`Собрано: ${this.score} / 3`);

          if (this.score === 3) {
            this.gameUI.showMessage("Вы молодец!");
              console.log("complete");
              return;
          }
          
          // Создаем новую коробку
          this.createNewBox();
      }
  }
}
  private createNewBox(): void {
    const areaSize = 2000;
    const x = (Math.random() - 0.5) * areaSize;
    const y = (Math.random() - 0.5) * areaSize;
    const z = (Math.random() - 0.5) * areaSize;
    
    // Проверяем, чтобы новая коробка не появилась слишком близко к кораблю
    if (Vector3.Distance(new Vector3(x, y, z), this.ship.spaceShipBox.position) > 100) {
      this.createBox(x, y, z);
    } else {
      // Если слишком близко, пробуем еще раз
      this.createNewBox();
    }
  }
  calculateDeltaTime() {
    this.scene.registerBeforeRender(() => {
      this.deltaTime = (this.scene.getEngine().getDeltaTime() / 1000);
    });
  }

  private appyGravity() {
    const line = MeshBuilder.CreateLines(
      "gravityLine",
      { points: [Vector3.Zero(), Vector3.Zero()] },
      this.scene
    );

    const material = new StandardMaterial("gravityMaterial", this.scene);
    material.emissiveColor = new Color3(1, 0.2, 0.2);
    line.material = material;

    this.scene.onBeforePhysicsObservable.add(() => {
      const spaceshipCenter =
        this.ship.spaceShipAggregate.body.getBoundingBox().centerWorld;
      const planetMeshes = this.planetManager.getMeshes();

      planetMeshes.forEach((planet, index) => {
        const distance = Vector3.Distance(spaceshipCenter, planet.position);
        const planetRadius = planet.getBoundingInfo().boundingSphere.radius;

        const gravityDirection = planet.position
          .subtract(spaceshipCenter)
          .normalize()
          .scale(10);

        if (index === 0) {
          MeshBuilder.CreateLines(
            "gravityLine",
            {
              points: [
                spaceshipCenter,
                spaceshipCenter.add(gravityDirection.scale(10)),
              ],
              instance: line,
            },
            this.scene
          );
        }

        if (distance < 200 && distance > planetRadius * 3) {
          this.ship.spaceShipAggregate.body.applyImpulse(
            gravityDirection.scale(this.deltaTime),
            spaceshipCenter
          );
        }
      });
    });
  }

  public resize(): void {
    this.engine.resize();
  }
}
