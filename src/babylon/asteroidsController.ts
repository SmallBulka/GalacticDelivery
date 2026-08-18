import {
  Matrix,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  Scene,
  TransformNode,
  Texture,
  Color3,
  GlowLayer,
  StandardMaterial,
  Vector3,
  PhysicsShapeSphere,
} from "@babylonjs/core";
import { WORLD_SIZE, randomPointInWorld } from "./world/WorldBounds";

const ASTEROID_BATCH_SIZE = 200;
const ASTEROID_RADIUS = 7;
const ASTEROID_SPAWN_INSET = ASTEROID_RADIUS + 20;

export default class AsteroidsController {
  private scene: Scene;
  private parentAsteroid!: Mesh;
  private asteroidMaterial!: StandardMaterial;
  private glowLayer: GlowLayer;
  private worldSize: number;
  private asteroidsCount = 6000;
  private physicsParentTransformNode: TransformNode;
  private physicsShape!: PhysicsShapeSphere;

  constructor(scene: Scene, worldSize = WORLD_SIZE) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.glowLayer = new GlowLayer("glowLayer", scene, {
      renderingGroupId: 0,
      blurKernelSize: 16,
    });
    this.glowLayer.intensity = 0.6;
    this.createAsteroidMaterial();
    this.createParentAsteroid();
    this.physicsParentTransformNode = new TransformNode(
      "physicsParentTransformNode",
      this.scene
    );
  }

  private createParentAsteroid(): void {
    this.parentAsteroid = MeshBuilder.CreateSphere(
      "parentAsteroid",
      { diameter: ASTEROID_RADIUS * 2, segments: 4, updatable: false },
      this.scene
    );
    this.parentAsteroid.material = this.asteroidMaterial;
    this.physicsShape = new PhysicsShapeSphere(
      new Vector3(0, 0, 0),
      ASTEROID_RADIUS,
      this.scene
    );
  }

  private createAsteroidMaterial(): void {
    this.asteroidMaterial = new StandardMaterial("asteroidMaterial", this.scene);
    const noiseTexture = new Texture("./textures/coral.png", this.scene);
    this.asteroidMaterial.diffuseTexture = noiseTexture;
    this.asteroidMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    this.asteroidMaterial.emissiveColor = new Color3(0.3, 0.3, 0.3);
  }

  public excludeFromGlow(mesh: Mesh): void {
    this.glowLayer.addExcludedMesh(mesh);
  }

  public async initialize(
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    await this.generateAsteroidField(onProgress);
    console.log(
      `Generated ${this.asteroidsCount} asteroids in ${this.worldSize}x${this.worldSize}x${this.worldSize} space`
    );
  }

  private async generateAsteroidField(
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < this.asteroidsCount; i++) {
      const position = randomPointInWorld(ASTEROID_SPAWN_INSET);

      this.createAsteroid(position);

      if ((i + 1) % ASTEROID_BATCH_SIZE === 0 || i + 1 === this.asteroidsCount) {
        onProgress?.(i + 1, this.asteroidsCount);
        await this.yieldToBrowser();
      }
    }
  }

  private yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  private createAsteroid(position: Vector3): void {
    const matrix = Matrix.Translation(position.x, position.y, position.z);
    this.parentAsteroid.thinInstanceAdd(matrix);

    const transformNode = new TransformNode(
      `asteroid_${position.x}_${position.y}_${position.z}`,
      this.scene
    );
    transformNode.position = position;

    new PhysicsAggregate(
      transformNode,
      this.physicsShape,
      { mass: 0, restitution: 0.7 },
      this.scene
    );
    this.physicsParentTransformNode.addChild(transformNode);
  }

  public dispose(): void {
    this.asteroidMaterial.dispose();
    this.glowLayer.dispose();
  }
}
