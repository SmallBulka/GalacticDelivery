// src/babylon/PhysicsScene.ts
import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType,
  StandardMaterial,
  Texture,
  Mesh,
  PhysicsMotionType,
  PointLight,
  Color3,
  Color4,
  ParticleSystem,
  NoiseProceduralTexture,
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
import { EMPTY_INPUT_STATE } from "./spaceships/IInputState";

export class SpaceScene {
  private engine: Engine;
  private scene: Scene;
  private cameraManager!: CameraManager;
  private ship!: SpaceShip;
  private hk!: HavokPlugin;
  private planets: Mesh[] = [];
  private boxes: Mesh[] = [];
  private score: number = 0;
  private gameUI!: GameUI;
  private boxCount: number = 100;
  private collectDistance: number = 10;
  private deltaTime: number = 0;
  private atmosphereMaterial!: StandardMaterial;
  private nebulaParticles!: ParticleSystem;
  private advancedTexture?: AdvancedDynamicTexture;
  private isComplete: boolean = false;
  private havokInstance: any;
  private loadingScreen: StatusLoadingScreen;
  private planetDiffuseCache = new Map<string, Texture>();
  private sharedBumpTexture?: Texture;
    //  поля для системы чанков
    private loadedChunks = new Map<string, boolean>();
    private chunkSize = 3000; // Размер одного чанка
    private generationDistance = 5000; // Дистанция генерации
    private lastChunkUpdatePos = Vector3.Zero();
    private chunkUpdateThreshold = 800; // Дистанция для обновления чанков
    private planetsPerChunk = 1; // Количество планет в одном чанке
    private minPlanetSize = 50;  // Минимальный размер планеты
    private maxPlanetSize = 600; // Максимальный размер планеты
    private generationDensity = 1.0;


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
          createShip: () => this.CreateShip(),
          createInitialPlanets: () => this.createInitialPlanets(),
          initGameUI: () => this.initGameUI(),
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

    const skybox = MeshBuilder.CreateBox("skyBox", { size: 10000 }, this.scene);
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

  private generateSpaceChunk(centerX: number, centerY: number, centerZ: number) {
    const planetCount = Math.floor(this.planetsPerChunk * this.generationDensity);
    for (let i = 0; i < planetCount; i++) {
      const x = centerX + (Math.random() - 0.5) * this.chunkSize;
      const y = centerY + (Math.random() - 0.5) * this.chunkSize;
      const z = centerZ + (Math.random() - 0.5) * this.chunkSize;
      const size = this.minPlanetSize + Math.random() * (this.maxPlanetSize - this.minPlanetSize);
      
      this.createPlanet(x, y, z, size);
    }
  }

  private getSharedBumpTexture(): Texture {
    if (!this.sharedBumpTexture) {
      this.sharedBumpTexture = new Texture(
        "./textures/rocky_terrain_03_nor_gl_4k.jpg",
        this.scene
      );
      this.sharedBumpTexture.level = 1.5;
    }
    return this.sharedBumpTexture;
  }

  private getPlanetDiffuseTexture(fileName: string): Texture {
    let texture = this.planetDiffuseCache.get(fileName);
    if (!texture) {
      texture = new Texture(`./textures/${fileName}`, this.scene);
      this.planetDiffuseCache.set(fileName, texture);
    }
    return texture;
  }

  private createPlanet(x: number, y: number, z: number, size: number): Mesh {
    const planet = MeshBuilder.CreateSphere(
      `planet_${x}_${y}_${z}`,
      { diameter: size, segments: 32 },
      this.scene
    );
    planet.position = new Vector3(x, y, z);

    const planetMaterial = new StandardMaterial(
      `planetMat_${x}_${y}_${z}`,
      this.scene
    );
    planetMaterial.diffuseColor = new Color3(0.8, 0.8, 0.8);
    planetMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    planetMaterial.specularPower = 5;
    planetMaterial.roughness = 0.85;
    planetMaterial.emissiveColor = new Color3(0, 0, 0);

    const textureTypes = [
      "mars.jpg",
      "neptune.jpg",
      "daymap.jpg",
      "surface.jpg",
      "jupiter.jpg",
    ];
    const randomType =
      textureTypes[Math.floor(Math.random() * textureTypes.length)];

    try {
      planetMaterial.diffuseTexture = this.getPlanetDiffuseTexture(randomType);
      planetMaterial.bumpTexture = this.getSharedBumpTexture();
    } catch (error) {
      console.error("Ошибка загрузки текстуры:", error);
      const noiseTexture = new NoiseProceduralTexture(
        "fallbackTex",
        512,
        this.scene
      );
      planetMaterial.diffuseTexture = noiseTexture;
    }

    planet.material = planetMaterial;
    this.createAtmosphere(planet, size * 1.5);

    new PhysicsAggregate(
      planet,
      PhysicsShapeType.SPHERE,
      {
        mass: 0,
        friction: 0.7,
        restitution: 0,
      },
      this.scene
    );

    this.planets.push(planet);
    return planet;
  }

private createAtmosphere(planet: Mesh, size: number): void {
    // 1. Создаем меш атмосферы
    const atmosphere = MeshBuilder.CreateSphere(
        `atmosphere_${planet.name}`,
        { diameter: size, segments: 32 },
        this.scene
    );
    
    // 2. Используем ЕДИНЫЙ материал для всех атмосфер
    if (!this.atmosphereMaterial) {
        this.atmosphereMaterial = new StandardMaterial("atmosphereMaterial", this.scene);
        this.atmosphereMaterial.emissiveColor = new Color3(0.2, 0.5, 0.5);//берюзовый
        this.atmosphereMaterial.alpha = 0.25;
        this.atmosphereMaterial.alphaMode = Engine.ALPHA_COMBINE;
        this.atmosphereMaterial.backFaceCulling = false;
    }
    
    atmosphere.material = this.atmosphereMaterial;
    // atmosphere.position = planet.position.clone();
    
    // 3. Жесткая привязка к планете
    atmosphere.parent = planet;
    planet.metadata = { atmosphere }; // Сохраняем ссылку
    
    // 4. Оптимизации
    atmosphere.isPickable = false;
    atmosphere.receiveShadows = false;
}

private updateChunks() {
  if (!this.ship?.spaceShipBox) return;
  
  const shipPos = this.ship.spaceShipBox.position;
  if (Vector3.Distance(shipPos, this.lastChunkUpdatePos) < this.chunkUpdateThreshold) {
    return;
  }
  
  this.lastChunkUpdatePos = shipPos.clone();
  const chunkX = Math.floor(shipPos.x / this.chunkSize) * this.chunkSize;
  const chunkY = Math.floor(shipPos.y / this.chunkSize) * this.chunkSize;
  const chunkZ = Math.floor(shipPos.z / this.chunkSize) * this.chunkSize;
  
  for (let x = -this.generationDistance; x <= this.generationDistance; x += this.chunkSize) {
    for (let y = -this.generationDistance/2; y <= this.generationDistance/2; y += this.chunkSize) {
      for (let z = -this.generationDistance; z <= this.generationDistance; z += this.chunkSize) {
        const chunkKey = `${chunkX + x}_${chunkY + y}_${chunkZ + z}`;
        
        if (!this.loadedChunks.has(chunkKey)) {
          this.generateSpaceChunk(chunkX + x, chunkY + y, chunkZ + z);
          this.loadedChunks.set(chunkKey, true);
        }
      }
    }
  }
  
  this.cleanupDistantChunks(shipPos);
}

private cleanupDistantChunks(shipPos: Vector3) {
  const chunksToRemove: string[] = [];
  
  this.loadedChunks.forEach((_, key) => {
    const [x, y, z] = key.split('_').map(Number);
    if (Vector3.Distance(shipPos, new Vector3(x, y, z)) > this.generationDistance * 1.5) {
      chunksToRemove.push(key);
    }
  });
  
  chunksToRemove.forEach(key => {
    this.disposeChunk(key);
    this.loadedChunks.delete(key);
  });
}

private disposeChunk(chunkKey: string) {
  const [x, y, z] = chunkKey.split('_').map(Number);
  
  this.planets = this.planets.filter(planet => {
    const planetX = Math.floor(planet.position.x / this.chunkSize) * this.chunkSize;
    const planetY = Math.floor(planet.position.y / this.chunkSize) * this.chunkSize;
    const planetZ = Math.floor(planet.position.z / this.chunkSize) * this.chunkSize;
    
    if (planetX === x && planetY === y && planetZ === z) {
      planet.getChildMeshes().forEach(child => child.dispose());
      planet.dispose();
      return false;
    }
    return true;
  });
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

private createScene() {
  void this.start();
}
  private createNebulaEffect(): void {
    // Создаем систему частиц для туманности
    this.nebulaParticles = new ParticleSystem("nebulaParticles", 2000, this.scene);
    
    // Настройка текстуры частиц
    this.nebulaParticles.particleTexture = new Texture("./textures/01.jpg", this.scene);
    
    // Цвета частиц (исправлено на Color4 для альфа-канала)
    this.nebulaParticles.color1 = new Color4(0.7, 0.8, 1.0, 0.3);
    this.nebulaParticles.color2 = new Color4(0.2, 0.5, 1.0, 0.1);
    this.nebulaParticles.colorDead = new Color4(0, 0, 0.2, 0.0);
    
    // Размеры частиц
    this.nebulaParticles.minSize = 0.8;
    this.nebulaParticles.maxSize = 4.0;
    
    // Время жизни частиц
    this.nebulaParticles.minLifeTime = 2.0;
    this.nebulaParticles.maxLifeTime = 5.0;
    
    // Скорость испускания
    this.nebulaParticles.emitRate = 50;
    
    // Направление и разброс
    this.nebulaParticles.direction1 = new Vector3(-5, -1, -5);
    this.nebulaParticles.direction2 = new Vector3(5, 1, 5);
    // Зона испускания
    this.nebulaParticles.minEmitBox = new Vector3(-10, -10, 40); // Сдвигаем по Z назад
    this.nebulaParticles.maxEmitBox = new Vector3(10, 10, -15);  
    
    // Настройки прозрачности (раскомментируйте, если нужно)
    // this.nebulaParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
  }

  private getRandomPosition(min: number, max: number): Vector3 {
    const x = Math.floor(Math.random() * (max - min + 1)) + min; // Случайное число между min и max
    const y = Math.floor(Math.random() * (max - min + 1)) + min; // Случайное число между min и max
    const z = Math.floor(Math.random() * (max - min + 1)) + min; // Случайное число между min и max
    return new Vector3(x, y, z);
  }
  private createMesh() {
    const material = new StandardMaterial("material", this.scene);
    material.emissiveColor = new Color3(0, 0, 0);
    material.specularColor = new Color3(0, 0, 0);
    const texture = new Texture("./textures/t.jpg", this.scene);
    material.diffuseTexture = texture;
    
    const numPlanets = 6;
    const minPlanetSize = 100;
    const maxPlanetSize = 600;
    const minDistanceMultiplier = 2.5; // Минимальное расстояние между планетами (относительно размера)
    const maxAttempts = 50; // Максимальное количество попыток генерации позиции
    const atmosphereSizeFactor = 1.3;

    // Предопределенная палитра атмосферных цветов
    const atmosphereColors = [
        new Color3(0.2, 0.5, 1.0),  // Голубой
        new Color3(0.3, 0.8, 0.9),  // Бирюзовый
        new Color3(0.8, 0.3, 0.5),  // Розовый
        new Color3(0.5, 0.8, 0.3),  // Салатовый
        new Color3(0.9, 0.6, 0.2),  // Оранжевый
        new Color3(0.7, 0.3, 0.8)   // Фиолетовый
    ];

    for (let i = 0; i < numPlanets; i++) {
        let planetDiameter: number;
        let position: Vector3;
        let validPosition = false;
        let attempts = 0;

        // Пытаемся найти валидную позицию
        while (!validPosition && attempts < maxAttempts) {
            attempts++;
            planetDiameter = minPlanetSize + Math.random() * (maxPlanetSize - minPlanetSize);
            position = this.getRandomPosition(-1000, 1000);
            validPosition = true;

            // Проверяем коллизии с существующими планетами
            for (const existingPlanet of this.planets) {
                const existingDiameter = existingPlanet.getBoundingInfo().boundingSphere.radius * 2;
                const distance = Vector3.Distance(position, existingPlanet.position);
                const minAllowedDistance = (planetDiameter + existingDiameter) * minDistanceMultiplier / 2;

                if (distance < minAllowedDistance) {
                    validPosition = false;
                    break;
                }
            }

            // Если это первая планета, позиция всегда валидна
            if (this.planets.length === 0) {
                validPosition = true;
            }
        }

        if (!validPosition) {
            console.warn(`Не удалось найти валидную позицию для планеты ${i} после ${maxAttempts} попыток`);
            continue;
        }

        const planetDiameters = minPlanetSize + Math.random() * (maxPlanetSize - minPlanetSize);
        const atmosphereDiameter = planetDiameters * atmosphereSizeFactor;
        
        const sphere = MeshBuilder.CreateSphere(
            `planet${i}`,
            { diameter: planetDiameters, segments: 32 },
            this.scene
        );
        
        const atmosphere = MeshBuilder.CreateSphere(
            `atmosphere${i}`,
            { diameter: atmosphereDiameter, segments: 32 },
            this.scene
        );

        // Создаем материал для атмосферы
        const atmosphereMaterial = new StandardMaterial(`atmosphereMat${i}`, this.scene);
        atmosphereMaterial.emissiveColor = atmosphereColors[i % atmosphereColors.length];
        atmosphereMaterial.alpha = 0.15 + Math.random() * 0.15;
        atmosphereMaterial.specularColor = new Color3(0, 0, 0);
        atmosphereMaterial.backFaceCulling = false;
        atmosphereMaterial.alphaMode = Engine.ALPHA_COMBINE;
        
        atmosphere.material = atmosphereMaterial;
        sphere.position = position;
        atmosphere.position = sphere.position.clone();
        
        new PhysicsAggregate(
            sphere,
            PhysicsShapeType.SPHERE,
            { mass: 0, friction: 1, restitution: 0, radius: planetDiameters/2 },
            this.scene
        ).body.setMotionType(PhysicsMotionType.STATIC);
        
        sphere.material = material;
        this.planets.push(sphere);
    }
}
  private async CreateShip() {
    this.ship = new SpaceShip(this.scene);
    await this.ship.createSpaceShip();
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

      if (this.ship?.spaceShipAggregate && this.nebulaParticles) {
        const velocity = this.ship.spaceShipAggregate.body.getLinearVelocity();
        const speed = velocity.length();
        this.nebulaParticles.emitRate = Math.min(200, speed * 2);

        if (speed > 0.1) {
          const direction = velocity.normalize().scale(-1);
          this.nebulaParticles.direction1 = direction.scale(5);
          this.nebulaParticles.direction2 = direction.scale(5);
        }
      }
    });
  }

  private async initAsteroids(
    onProgress: (done: number, total: number) => void
  ): Promise<void> {
    const asteroidsController = new AsteroidsController(this.scene);
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
    // boxMat.specularColor = new Color3(0.9, 0.1, 0.1);
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
  private async createInitialPlanets() {
    
    // Создаем начальные планеты вокруг нулевых координат
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 1000;
      const z = (Math.random() - 0.5) * 2000;
      const size = 50 + Math.random() * 100;
      this.createPlanet(x, y, z, size);
    }
  }
  
  calculateDeltaTime() {
    this.scene.registerBeforeRender(() => {
      this.deltaTime = (this.scene.getEngine() as any).getDeltaTime() / 1000;
    });
  }
  private appyGravity() {
    const line = MeshBuilder.CreateLines(
        "gravityLine",
        { points: [Vector3.Zero(), Vector3.Zero()] },
        this.scene
    );
    
    const material = new StandardMaterial("gravityMaterial", this.scene);
    material.emissiveColor = new Color3(1, 0.2, 0.2); // Красноватый цвет
    line.material = material;

    this.scene.onBeforePhysicsObservable.add(() => {
        const spaceshipCenter = this.ship.spaceShipAggregate.body.getBoundingBox().centerWorld;
        
        // Применяем гравитацию от всех планет
        this.planets.forEach(planet => {
            const distance = Vector3.Distance(spaceshipCenter, planet.position);
            const planetRadius = planet.getBoundingInfo().boundingSphere.radius;
            
            // Уменьшенная сила притяжения (было 10, стало 2)
            const gravityDirection = planet.position
                .subtract(spaceshipCenter)
                .normalize()
                .scale(10); // Уменьшили силу с 10 до 2
            
            // Визуализация только для ближайшей планеты
            if (planet === this.planets[0]) {
                const points = [
                    spaceshipCenter,
                    spaceshipCenter.add(gravityDirection.scale(10)) // Меньший масштаб визуализации
                ];
                MeshBuilder.CreateLines(
                    "gravityLine",
                    { points, instance: line },
                    this.scene
                );
            }
            
            // Мягкое притяжение (дистанция проверки уменьшена с 300 до 200)
            if (distance < 200 && distance > planetRadius * 3) {
                this.ship.spaceShipAggregate.body.applyImpulse(
                    gravityDirection.scale(this.deltaTime), // Добавили deltaTime для плавности
                    spaceshipCenter
                );
            }
        });
    });
    
}

  private createSphere() {
    console.log("");
  }
  private createQuest() {
    console.log("");
  }
  private async importLocation() {
    console.log("");
  }
  public resize(): void {
    this.engine.resize();
  }
}
