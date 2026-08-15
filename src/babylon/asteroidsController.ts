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

const ASTEROID_BATCH_SIZE = 200;

export default class AsteroidsController {
  private scene: Scene;
  private parentAsteroid!: Mesh;
  private asteroidMaterial!: StandardMaterial;
  private glowLayer: GlowLayer;
  private worldSize = 7000;
  private asteroidsCount = 8000;
  private physicsParentTransformNode: TransformNode;
  private physicsShape!: PhysicsShapeSphere;

  constructor(scene: Scene) {
    this.scene = scene;
    this.glowLayer = new GlowLayer("glowLayer", scene);
    this.glowLayer.intensity = 0.9;
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
      { diameter: 7, segments: 4, updatable: false },
      this.scene
    );
    this.parentAsteroid.material = this.asteroidMaterial;
    this.physicsShape = new PhysicsShapeSphere(
      new Vector3(0, 0, 0),
      7,
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
    const halfSize = this.worldSize / 2;

    for (let i = 0; i < this.asteroidsCount; i++) {
      const position = new Vector3(
        -halfSize + Math.random() * this.worldSize,
        -halfSize + Math.random() * this.worldSize,
        -halfSize + Math.random() * this.worldSize
      );

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
