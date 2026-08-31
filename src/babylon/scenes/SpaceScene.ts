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
  CubeTexture,
  BackgroundMaterial,
  SceneLoader,
  PBRMaterial,
  Material,
  Matrix,
} from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { GameUI } from "../gui/GameUI";
import { StatusLoadingScreen } from "../loading/StatusLoadingScreen";
import { SceneBootstrap } from "./SceneBootstrap";
import { Inspector } from "@babylonjs/inspector";
import "@babylonjs/loaders";
import SpaceShip from "./spaceships/spaceShip";
import { ShipTrailParticles } from "./spaceships/ShipTrailParticles";
import AsteroidsController from "../asteroidsController";
import HK from "@babylonjs/havok";
import { CameraManager } from "./spaceships/CameraManager";
import { PlanetManager } from "../planets/PlanetManager";
import { QuestManager } from "../quests/QuestManager";
import { EMPTY_INPUT_STATE } from "./spaceships/IInputState";
import { WORLD_SIZE, WorldBounds } from "../world/WorldBounds";
import { ENERGY_PER_CRATE, ShipEnergy } from "../ship/ShipEnergy";
import { AudioManager } from "../audio/AudioManager";

export class SpaceScene {
  private engine: Engine;
  private scene: Scene;
  private cameraManager!: CameraManager;
  private ship!: SpaceShip;
  private planetManager!: PlanetManager;
  private questManager!: QuestManager;
  private hk!: HavokPlugin;
  private boxes: Mesh[] = [];
  /** Локальный центр bbox банки (для дешёвого world-центра без refreshBoundingInfo). */
  private pickupLocalCenters = new Map<Mesh, Vector3>();
  /** Ближайшие банки в общем scene GlowLayer (PlanetManager). */
  private glowingPickups = new Set<Mesh>();
  private pickupGlowFrame = 0;
  private readonly pickupCenterScratch = new Vector3();
  private readonly pickupInvMatrixScratch = new Matrix();
  private shipEnergy = new ShipEnergy();
  private audioManager = new AudioManager();
  private pickupJarTemplate: Mesh | null = null;
  private pickupJarId = 0;
  private pickupJarScale = 1;
  private gameUI!: GameUI;
  private boxCount: number = 100;
  private collectDistance: number = 22;
  /** Целевой размер банки в мире (как бывший box size ≈ 4). */
  private readonly pickupJarTargetSize = 5;
  private deltaTime: number = 0;
  private shipTrail?: ShipTrailParticles;
  private asteroidsController?: AsteroidsController;
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
      void this.startAudioAfterLoading();
    }

    this.engine.runRenderLoop(() => {
      if (!this.havokInstance) {
        return;
      }
      this.scene.render();
    });
  }

  /** Музыка только после снятия loading screen. */
  private async startAudioAfterLoading(): Promise<void> {
    await this.audioManager.preload();
    this.audioManager.playMusic("ambient", { loop: true });
    this.audioManager.armAutoplayUnlock(this.canvas);
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
    this.shipTrail = new ShipTrailParticles(this.scene, this.ship.spaceShipBox);
  }

  private initGameUI(): void {
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
    this.gameUI = new GameUI(
      this.advancedTexture,
      (partial) => this.ship.updateFlightSettings(partial),
      () => this.ship.getFlightSettings(),
      this.audioManager
    );
    this.gameUI.initialize();
    this.gameUI.bindKeyboardDisplay(
      this.scene,
      () => this.ship.getGamepadStickDisplay()
    );
    this.ship.setControlsLockChecker(() => this.gameUI.isAnyModalOpen());
    this.ship.setOnRestart(() => {
      this.shipEnergy.reset();
      this.ship.setThrustMultiplier(1);
      this.gameUI.resetEnergyWarning();
      this.gameUI.updateEnergyWarning(this.shipEnergy.getEnergy());
    });
  }

  private setupRenderHooks(): void {
    this.scene.registerBeforeRender(() => {
      const dt =
        this.deltaTime > 0
          ? this.deltaTime
          : this.scene.getEngine().getDeltaTime() / 1000;

      const input = this.ship ? this.ship.getInput() : EMPTY_INPUT_STATE;
      this.cameraManager.update(input, dt);

      this.updateChunks();
      this.updateBoxCollection();
      this.updatePickupJarVisuals(dt);
      this.questManager?.update(dt);

      if (this.ship?.spaceShipBox) {
        this.asteroidsController?.update(this.ship.spaceShipBox.position);
      }

      if (this.ship?.spaceShipAggregate) {

        const pos = this.ship.spaceShipBox.position;
        const justEmpty = this.shipEnergy.updateFromPosition(pos.x, pos.y, pos.z);
        this.ship.setThrustMultiplier(this.shipEnergy.getThrustMultiplier());

        if (justEmpty) {
          this.gameUI.updateEnergyWarning(0);
        }

        const speed = this.ship.getSpeed();
        this.gameUI?.updateSpeedometer(
          speed,
          this.ship.getFlightSettings().maxSpeed,
          this.shipEnergy.getEnergy(),
          this.shipEnergy.getCratesCollected()
        );

        if (this.shipTrail) {
          const velocity = this.ship.spaceShipAggregate.body.getLinearVelocity();
          this.shipTrail.update(speed, velocity);
        }
      }
    });
  }

  private async initAsteroids(
    onProgress: (done: number, total: number) => void
  ): Promise<void> {
    this.asteroidsController = new AsteroidsController(this.scene, WORLD_SIZE);
    await this.asteroidsController.initialize(onProgress);
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

  private async generateBoxes(): Promise<void> {
    await this.loadPickupJarTemplate();
    const areaSize = 1000;

    for (let i = 0; i < this.boxCount; i++) {
      this.createBox(
        (Math.random() - 0.5) * areaSize,
        (Math.random() - 0.5) * areaSize,
        (Math.random() - 0.5) * areaSize
      );
    }
  }

  private async loadPickupJarTemplate(): Promise<void> {
    if (this.pickupJarTemplate) return;

    const result = await SceneLoader.ImportMeshAsync(
      "",
      "./model/",
      "Pickup Jar .glb",
      this.scene
    );

    const meshList = result.meshes.filter(
      (m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0
    );

    let root: Mesh;
    if (meshList.length === 0) {
      throw new Error("Pickup Jar .glb: нет геометрии");
    }
    if (meshList.length === 1) {
      root = meshList[0];
    } else {
      const merged = Mesh.MergeMeshes(
        meshList,
        true,
        true,
        undefined,
        false,
        true
      );
      if (!merged) {
        throw new Error("Pickup Jar .glb: не удалось объединить меши");
      }
      root = merged;
    }

    // Прячем исходник — клоны идут в мир.
    root.setEnabled(false);
    root.isVisible = false;
    root.isPickable = false;

    const bounds = root.getBoundingInfo().boundingBox;
    const size = bounds.extendSize.scale(2);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    this.pickupJarScale = this.pickupJarTargetSize / maxDim;

    this.applyPickupInnerGlow(root);
    this.pickupJarTemplate = root;
  }

  /** Свечение цветом текстуры модели + лёгкий bloom у ближайших банок. */
  private applyPickupInnerGlow(mesh: Mesh): void {
    const paint = (mat: Material | null | undefined) => {
      if (!mat) return;
      if (mat instanceof PBRMaterial) {
        // Emissive = albedo → «светится изнутри» своими цветами, не белеет.
        if (mat.albedoTexture && !mat.emissiveTexture) {
          mat.emissiveTexture = mat.albedoTexture;
        }
        mat.emissiveColor = Color3.White();
        mat.emissiveIntensity = 0.55;
      } else if (mat instanceof StandardMaterial) {
        if (mat.diffuseTexture && !mat.emissiveTexture) {
          mat.emissiveTexture = mat.diffuseTexture;
        }
        mat.emissiveColor = new Color3(0.55, 0.55, 0.55);
      }
    };

    paint(mesh.material);
    if (mesh.material && "subMaterials" in mesh.material) {
      const multi = mesh.material as { subMaterials?: (Material | null)[] };
      multi.subMaterials?.forEach((m) => paint(m));
    }
  }

  private createBox(x: number, y: number, z: number): void {
    if (!this.pickupJarTemplate) {
      console.warn("Pickup Jar template ещё не загружен");
      return;
    }

    const id = this.pickupJarId++;
    const jar = this.pickupJarTemplate.clone(`pickupJar_${id}`, null);
    if (!jar) return;

    jar.setEnabled(true);
    jar.isVisible = true;
    jar.isPickable = false;
    jar.position = new Vector3(x, y, z);
    jar.rotation = new Vector3(0, Math.random() * Math.PI * 2, 0);
    jar.scaling.setAll(this.pickupJarScale);
    jar.computeWorldMatrix(true);
    jar.refreshBoundingInfo(true, true);

    const worldCenter = jar.getBoundingInfo().boundingBox.centerWorld;
    jar.getWorldMatrix().invertToRef(this.pickupInvMatrixScratch);
    const localCenter = Vector3.TransformCoordinates(
      worldCenter,
      this.pickupInvMatrixScratch
    );
    this.pickupLocalCenters.set(jar, localCenter);

    this.boxes.push(jar);
  }

  private getPickupWorldCenter(jar: Mesh, out: Vector3): Vector3 {
    const local = this.pickupLocalCenters.get(jar);
    if (!local) {
      out.copyFrom(jar.position);
      return out;
    }
    Vector3.TransformCoordinatesToRef(local, jar.getWorldMatrix(), out);
    return out;
  }

  private updatePickupJarVisuals(dt: number): void {
    for (const jar of this.boxes) {
      jar.rotation.y += dt * 0.45;
    }

    // Glow / сортировку — реже, чем каждый кадр
    this.pickupGlowFrame += 1;
    if (this.pickupGlowFrame % 10 === 0) {
      this.refreshNearbyPickupGlow();
    }
  }

  /** Bloom только у ~8 ближайших банок — через общий sceneGlow. */
  private refreshNearbyPickupGlow(): void {
    if (!this.planetManager || !this.ship?.spaceShipBox) return;

    const glow = this.planetManager.getGlowLayer();
    const shipPos = this.ship.spaceShipBox.getAbsolutePosition();
    const maxDistSq = 200 * 200;
    const maxCount = 8;
    const scratch = this.pickupCenterScratch;

    const nearest: { jar: Mesh; d: number }[] = [];
    for (const jar of this.boxes) {
      const c = this.getPickupWorldCenter(jar, scratch);
      const d = Vector3.DistanceSquared(shipPos, c);
      if (d <= maxDistSq) {
        nearest.push({ jar, d });
      }
    }

    nearest.sort((a, b) => a.d - b.d);
    const next = new Set(
      nearest.slice(0, maxCount).map((x) => x.jar)
    );

    for (const jar of this.glowingPickups) {
      if (!next.has(jar)) {
        glow.removeIncludedOnlyMesh(jar);
        this.glowingPickups.delete(jar);
      }
    }

    for (const jar of next) {
      if (!this.glowingPickups.has(jar)) {
        glow.addIncludedOnlyMesh(jar);
        this.glowingPickups.add(jar);
      }
    }
  }

  private updateBoxCollection(): void {
    if (!this.ship?.spaceShipBox || this.boxes.length === 0) return;

    const shipPos = this.ship.spaceShipBox.getAbsolutePosition();
    const sqrCollectDistance = this.collectDistance * this.collectDistance;
    const glow = this.planetManager?.getGlowLayer();
    const scratch = this.pickupCenterScratch;

    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const box = this.boxes[i];
      const center = this.getPickupWorldCenter(box, scratch);

      if (Vector3.DistanceSquared(shipPos, center) < sqrCollectDistance) {
        if (this.glowingPickups.has(box) && glow) {
          glow.removeIncludedOnlyMesh(box);
          this.glowingPickups.delete(box);
        }
        this.pickupLocalCenters.delete(box);
        box.dispose();

        this.boxes.splice(i, 1);
        this.shipEnergy.collectCrate();
        this.ship.setThrustMultiplier(this.shipEnergy.getThrustMultiplier());
        this.audioManager.playSfx("pickup");

        this.gameUI.showMessage(`Контейнер: +${ENERGY_PER_CRATE}% энергии`, 1800);

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
