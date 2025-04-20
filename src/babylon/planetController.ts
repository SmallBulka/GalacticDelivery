// import {

//   Matrix,
//   Mesh,
//   MeshBuilder,

//   Scene,

//   Vector3,
// } from "@babylonjs/core";


// export default class PlanetController {
//   private scene: Scene;
//   private positionsVectors: Vector3[] = [];
//   private positionsMatrix: Matrix[] = [];
//   private planet: Mesh;

//   constructor(scene: Scene) {
//     this.scene = scene;
//   }
//   //исколючить возможность спавна астероида в корабле
//   public async createPlanetController() {
//     this.mathPositions();
//     this.createPlanets();
//   }
//   getRandomNumber(min: number, max: number) {
//     return Math.floor(Math.random() * (max - min + 1)) + min;
//   }
//   async mathPositions() {
//     for (let i = 0; i < 100; i++) {
//       const position = new Vector3(
//         this.getRandomNumber(-500, 500),
//         this.getRandomNumber(-500, 500),
//         this.getRandomNumber(-500, 500)
//       );
//       this.positionsVectors.push(position);
//     }
//   }

//     async createPlanets() {
//       // const instanceArray = [];

//       this.planet = await MeshBuilder.CreateSphere(
//         "planet",
//         { diameter: 70 },
//         this.scene
//       );
//       //  const asteroidAggregate = await new PhysicsAggregate(this.asteroid, PhysicsShapeType.SPHERE, { mass: 0 }, this.scene);
//       //   let matricesData = new Float32Array(16 * this.positionsVectors.length);
//       this.positionsMatrix = await this.positionsVectors.map((pos) => {
//         const matrix = Matrix.Identity(); // Создаем единичную матрицу
//         matrix.setTranslation(pos); // Устанавливаем позицию
//         return matrix;
//       });

//       this.positionsMatrix.forEach((matrix) => {
//          this.planet.thinInstanceAdd(matrix);
//       });
      
//     }
// }
