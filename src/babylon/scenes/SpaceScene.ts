import {
  Engine,
  Scene,
  Vector3,
  HavokPlugin,
} from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { GameUI } from "../gui/GameUI";
import { StatusLoadingScreen } from "../loading/StatusLoadingScreen";
import { SceneBootstrap } from "./SceneBootstrap";
import { SceneEnvironment } from "./SceneEnvironment";
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
import { WORLD_SIZE } from "../world/WorldBounds";
import { PlanetGravity } from "../world/PlanetGravity";
import { PickupJarSystem } from "../pickups/PickupJarSystem";
import {
  ENERGY_COLLISION_PENALTY,
  ShipEnergy,
} from "../ship/ShipEnergy";
import { AudioManager } from "../audio/AudioManager";
import { loadFlightSettings } from "./spaceships/FlightSettingsConfig";

/**
 * Оркестратор сцены: жизненный цикл, склейка систем, render loop.
 */
export class SpaceScene {
  private engine: Engine;
  private scene: Scene;
  private cameraManager!: CameraManager;
  private ship!: SpaceShip;
  private planetManager!: PlanetManager;
  private questManager!: QuestManager;
  private pickupJars!: PickupJarSystem;
  private planetGravity?: PlanetGravity;
  private hk!: HavokPlugin;
  private shipEnergy = new ShipEnergy();
  private audioManager = new AudioManager();
  private gameUI!: GameUI;
  private deltaTime = 0;
  private shipTrail?: ShipTrailParticles;
  private asteroidsController?: AsteroidsController;
  private advancedTexture?: AdvancedDynamicTexture;
  private havokInstance: unknown;
  private loadingScreen: StatusLoadingScreen;
  private disposed = false;

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
      if (this.disposed) return;

      this.loadingScreen.setStatus("Инициализация физики...");
      await this.initPhysics();
      if (this.disposed) return;

      this.loadingScreen.setStatus("Подготовка камеры и космоса...");
      this.createCamera();
      SceneEnvironment.createLights(this.scene);
      SceneEnvironment.createSkybox(this.scene);

      const bootstrap = new SceneBootstrap(
        (text) => this.loadingScreen.setStatus(text),
        {
          calculateDeltaTime: () => this.calculateDeltaTime(),
          createWorldBounds: () =>
            SceneEnvironment.createWorldBounds(this.scene),
          createShip: () => this.createShip(),
          createInitialPlanets: () => this.createInitialPlanets(),
          initGameUI: () => this.initGameUI(),
          initQuests: () => this.initQuests(),
          generateBoxes: () => this.generateBoxes(),
          updateChunks: () => this.updateChunks(),
          setupRenderHooks: () => this.setupRenderHooks(),
          initAsteroids: (onProgress) => this.initAsteroids(onProgress),
          applyGravity: () => this.applyGravity(),
          maybeShowInspector: () => this.maybeShowInspector(),
        }
      );
      await bootstrap.run();
      if (this.disposed) return;
    } catch (error) {
      if (this.disposed) return;
      console.error("Ошибка загрузки сцены:", error);
      this.loadingScreen.setStatus("Ошибка загрузки");
    } finally {
      if (!this.disposed) {
        this.engine.hideLoadingUI();
        void this.startAudioAfterLoading();
        this.gameUI?.showFirstRunIfNeeded();
      }
    }

    if (this.disposed) return;

    this.engine.runRenderLoop(() => {
      if (this.disposed || !this.havokInstance) return;
      this.scene.render();
    });
  }

  private async startAudioAfterLoading(): Promise<void> {
    if (this.disposed) return;
    await this.audioManager.preload();
    if (this.disposed) return;
    this.audioManager.playMusic("ambient", { loop: true });
    this.audioManager.armAutoplayUnlock(this.canvas);
  }

  private createCamera(): void {
    this.cameraManager = new CameraManager(this.scene, {
      followOffset: new Vector3(0, 4.5, -20),
      positionSmoothness: 6,
      rotationSmoothness: 4,
    });
  }

  private async createInitialPlanets(): Promise<void> {
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
      (msg, options) => {
        if (options?.critical) {
          this.gameUI.showPriorityAlert(msg, 6500);
        } else if (options?.questComplete && options.questTitle) {
          this.gameUI.showQuestCompleteToast(options.questTitle);
        } else {
          this.gameUI.showMessage(msg, 4000);
        }
      },
      (items) => this.gameUI.refreshQuestList(items)
    );
    this.questManager.initialize();
    this.gameUI.setQuestSelectHandler((id) =>
      this.questManager.selectQuest(id)
    );
    this.ship.setOnStrongImpact((impactSpeed) => {
      this.audioManager.playSfx("collision");
      this.cameraManager.shake(Math.min(1, 0.35 + impactSpeed / 80));
      this.shipEnergy.drainPercent(ENERGY_COLLISION_PENALTY);
      this.ship.setThrustMultiplier(this.shipEnergy.getThrustMultiplier());
      this.gameUI.updateEnergyWarning(this.shipEnergy.getEnergy());
      this.questManager.notifyStrongImpact();
    });
  }

  private updateChunks(): void {
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

  private async createShip(): Promise<void> {
    this.ship = new SpaceShip(this.scene, loadFlightSettings());
    await this.ship.createSpaceShip();
    this.ship.spaceShipBox.renderingGroupId = 1;
    this.scene.setRenderingAutoClearDepthStencil(1, false, false, false);
    this.cameraManager.attachTarget(this.ship.spaceShipBox, this.ship.spaceShipBox);
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

  private async generateBoxes(): Promise<void> {
    this.pickupJars = new PickupJarSystem({
      scene: this.scene,
      shipEnergy: this.shipEnergy,
      getShipPosition: () =>
        this.ship?.spaceShipBox?.getAbsolutePosition() ?? null,
      getGlowLayer: () => this.planetManager?.getGlowLayer(),
      setThrustMultiplier: (m) => this.ship.setThrustMultiplier(m),
      playPickupSfx: () => this.audioManager.playSfx("pickup"),
      showPickupMessage: (text) => this.gameUI.showMessage(text, 1800),
    });
    await this.pickupJars.generate();
  }

  private setupRenderHooks(): void {
    this.scene.registerBeforeRender(() => {
      const dt =
        this.deltaTime > 0
          ? this.deltaTime
          : this.scene.getEngine().getDeltaTime() / 1000;

      const input = this.ship ? this.ship.getInput() : EMPTY_INPUT_STATE;

      if (this.ship?.spaceShipAggregate) {
        this.ship.tickImpactSensor();
      }

      this.cameraManager.update(input, dt);

      this.updateChunks();
      this.pickupJars?.update(dt);
      this.questManager?.update(dt);

      if (this.ship?.spaceShipBox) {
        this.asteroidsController?.update(this.ship.spaceShipBox.position);
      }

      if (this.ship?.spaceShipAggregate) {
        const pos = this.ship.spaceShipBox.position;
        const justEmpty = this.shipEnergy.updateFromPosition(
          pos.x,
          pos.y,
          pos.z
        );
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
          const velocity =
            this.ship.spaceShipAggregate.body.getLinearVelocity();
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

  private calculateDeltaTime(): void {
    this.scene.registerBeforeRender(() => {
      this.deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
    });
  }

  private applyGravity(): void {
    this.planetGravity = new PlanetGravity(
      () => this.ship?.spaceShipAggregate?.body,
      () => this.ship.spaceShipBox.getAbsolutePosition(),
      () => this.planetManager.getAll()
    );

    this.scene.onBeforePhysicsObservable.add(() => {
      if (this.ship?.isMovementFrozen()) return;
      const dt =
        this.deltaTime > 0
          ? this.deltaTime
          : this.scene.getEngine().getDeltaTime() / 1000;
      this.planetGravity?.update(dt);
    });
  }

  public resize(): void {
    if (this.disposed) return;
    this.engine.resize();
  }

  /** Остановка render loop, аудио, сцены и движка (HMR / unmount React). */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    try {
      this.engine.stopRenderLoop();
    } catch {
      /* already stopped */
    }

    try {
      this.audioManager.dispose();
    } catch {
      /* ignore */
    }

    try {
      this.shipTrail?.dispose();
    } catch {
      /* ignore */
    }

    try {
      this.asteroidsController?.dispose();
    } catch {
      /* ignore */
    }

    try {
      this.advancedTexture?.dispose();
    } catch {
      /* ignore */
    }

    try {
      this.scene.dispose();
    } catch {
      /* ignore */
    }

    try {
      this.engine.dispose();
    } catch {
      /* ignore */
    }

    this.havokInstance = undefined;
    this.planetGravity = undefined;
  }
}
