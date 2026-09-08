import {
  AbstractMesh,
  Color4,
  ParticleSystem,
  Scene,
  Texture,
  Vector3,
} from "@babylonjs/core";

/**
 * След частиц за кораблём: интенсивность задаётся снаружи через setSpeed.
 */
export class ShipTrailParticles {
  private readonly particles: ParticleSystem;

  constructor(scene: Scene, emitter: AbstractMesh) {
    const ps = new ParticleSystem("shipTrail", 450, scene);
    ps.particleTexture = new Texture("./textures/01.jpg", scene);
    ps.emitter = emitter;
    ps.minEmitBox = new Vector3(-0.6, -0.35, -1.2);
    ps.maxEmitBox = new Vector3(0.6, 0.35, -0.4);
    ps.color1 = new Color4(0.45, 0.85, 1, 0.85);
    ps.color2 = new Color4(0.25, 0.45, 1, 0.35);
    ps.colorDead = new Color4(0.05, 0.1, 0.35, 0);
    ps.minSize = 0.12;
    ps.maxSize = 0.48;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.55;
    ps.emitRate = 0;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = Vector3.Zero();
    ps.direction1 = new Vector3(-0.4, -0.25, -2);
    ps.direction2 = new Vector3(0.4, 0.25, -4);
    ps.minEmitPower = 1.5;
    ps.maxEmitPower = 5;
    ps.updateSpeed = 0.018;
    ps.renderingGroupId = 1;
    ps.start();
    this.particles = ps;
  }

  /** Обновить поток по скорости и направлению полёта. */
  update(speed: number, velocity: Vector3): void {
    if (speed < 1.2) {
      this.particles.emitRate = 0;
      return;
    }

    this.particles.emitRate = Math.min(220, speed * 2.2);

    const dir = velocity.lengthSquared() > 0.01
      ? velocity.normalize().scale(-1)
      : new Vector3(0, 0, -1);
    this.particles.direction1 = dir.scale(3).add(new Vector3(-0.35, -0.2, 0));
    this.particles.direction2 = dir.scale(6).add(new Vector3(0.35, 0.2, 0));
  }

  dispose(): void {
    this.particles.dispose();
  }
}
