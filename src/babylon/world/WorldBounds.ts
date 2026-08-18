import {
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsMotionType,
  PhysicsShapeType,
  Scene,
  Vector3,
} from "@babylonjs/core";

/** Размер игрового куба (ребро). Стены стоят на гранях этого объёма. */
export const WORLD_SIZE = 7000;
export const WORLD_HALF = WORLD_SIZE / 2;

const WALL_THICKNESS = 40;

export function clampToWorld(
  x: number,
  y: number,
  z: number,
  inset = 0
): Vector3 {
  const limit = WORLD_HALF - inset;
  return new Vector3(
    Math.max(-limit, Math.min(limit, x)),
    Math.max(-limit, Math.min(limit, y)),
    Math.max(-limit, Math.min(limit, z))
  );
}

export function isInsideWorld(x: number, y: number, z: number, inset = 0): boolean {
  const limit = WORLD_HALF - inset;
  return (
    Math.abs(x) <= limit && Math.abs(y) <= limit && Math.abs(z) <= limit
  );
}

export function randomPointInWorld(inset = 0): Vector3 {
  const span = WORLD_SIZE - inset * 2;
  return new Vector3(
    -WORLD_HALF + inset + Math.random() * span,
    -WORLD_HALF + inset + Math.random() * span,
    -WORLD_HALF + inset + Math.random() * span
  );
}

/**
 * Шесть невидимых физических стен куба size × size × size.
 */
export class WorldBounds {
  readonly size: number;
  readonly half: number;
  private walls: Mesh[] = [];

  constructor(private scene: Scene, size = WORLD_SIZE) {
    this.size = size;
    this.half = size / 2;
  }

  createWalls(): void {
    const faces: Array<{ name: string; size: Vector3; position: Vector3 }> = [
      {
        name: "worldWall_px",
        size: new Vector3(WALL_THICKNESS, this.size, this.size),
        position: new Vector3(this.half + WALL_THICKNESS / 2, 0, 0),
      },
      {
        name: "worldWall_nx",
        size: new Vector3(WALL_THICKNESS, this.size, this.size),
        position: new Vector3(-(this.half + WALL_THICKNESS / 2), 0, 0),
      },
      {
        name: "worldWall_py",
        size: new Vector3(this.size, WALL_THICKNESS, this.size),
        position: new Vector3(0, this.half + WALL_THICKNESS / 2, 0),
      },
      {
        name: "worldWall_ny",
        size: new Vector3(this.size, WALL_THICKNESS, this.size),
        position: new Vector3(0, -(this.half + WALL_THICKNESS / 2), 0),
      },
      {
        name: "worldWall_pz",
        size: new Vector3(this.size, this.size, WALL_THICKNESS),
        position: new Vector3(0, 0, this.half + WALL_THICKNESS / 2),
      },
      {
        name: "worldWall_nz",
        size: new Vector3(this.size, this.size, WALL_THICKNESS),
        position: new Vector3(0, 0, -(this.half + WALL_THICKNESS / 2)),
      },
    ];

    for (const face of faces) {
      const wall = MeshBuilder.CreateBox(
        face.name,
        { width: face.size.x, height: face.size.y, depth: face.size.z },
        this.scene
      );
      wall.position = face.position;
      wall.isVisible = false;
      wall.isPickable = false;
      wall.checkCollisions = false;

      const aggregate = new PhysicsAggregate(
        wall,
        PhysicsShapeType.BOX,
        { mass: 0, friction: 0.2, restitution: 0.15 },
        this.scene
      );
      aggregate.body.setMotionType(PhysicsMotionType.STATIC);

      this.walls.push(wall);
    }
  }
}
