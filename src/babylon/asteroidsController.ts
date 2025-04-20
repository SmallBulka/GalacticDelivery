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
  PhysicsShapeMesh,
  PhysicsShapeSphere
} from "@babylonjs/core";


export default class AsteroidsController {
  private scene: Scene;
  private parentAsteroid!: Mesh;
  private asteroidMaterial!: StandardMaterial;
  private glowLayer: GlowLayer;
  private worldSize = 7000; // Размер игрового пространства
  private asteroidsCount = 8000; // Общее количество астероидов
  private physicsParentTransformNode: TransformNode;
  private physicsShape!: PhysicsShapeMesh;
  constructor(scene: Scene) {
    this.scene = scene;
    this.glowLayer = new GlowLayer("glowLayer", scene);
    this.glowLayer.intensity = 0.9;
    this.createAsteroidMaterial();
    this.createParentAsteroid();
    this.physicsParentTransformNode = new TransformNode("physicsParentTransformNode");
    
  }
  private createParentAsteroid(): void {
    this.parentAsteroid = MeshBuilder.CreateSphere("parentAsteroid", {  diameter: 7, segments: 4, updatable: false }, this.scene);
    this.parentAsteroid.material = this.asteroidMaterial;
    this.physicsShape = new PhysicsShapeSphere(
      new Vector3(0, 0, 0),
      7,
      this.scene
    );
  }
  private createAsteroidMaterial(): void {
    this.asteroidMaterial = new StandardMaterial("asteroidMaterial", this.scene);
    
    // Создаем простую текстуру с шумом для астероидов
    const noiseTexture = new Texture("./textures/coral.png", this.scene);
    this.asteroidMaterial.diffuseTexture = noiseTexture;
    
    this.asteroidMaterial.diffuseTexture = noiseTexture;
    this.asteroidMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    this.asteroidMaterial.emissiveColor = new Color3(0.3, 0.3, 0.3); // Свечение
    
  }

  public initialize(): void {
    this.generateAsteroidField();
    console.log(`Generated ${this.asteroidsCount} asteroids in ${this.worldSize}x${this.worldSize}x${this.worldSize} space`);
  }

  private async generateAsteroidField(): Promise<void> {
    const halfSize = this.worldSize / 2;
    
    for (let i = 0; i < this.asteroidsCount; i++) {
      const position = new Vector3(
        -halfSize + Math.random() * this.worldSize,
        -halfSize + Math.random() * this.worldSize,
        -halfSize + Math.random() * this.worldSize
      );

      this.createAsteroid(position);
    }
  }

  private createAsteroid(position: Vector3): void {

    const matrix = Matrix.Translation(position.x, position.y, position.z);
    this.parentAsteroid.thinInstanceAdd(matrix);

    
    
    // Добавляем физическое тело (опционально)
    const transformNode = new TransformNode(`asteroid_${position.x}_${position.y}_${position.z}`);
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
