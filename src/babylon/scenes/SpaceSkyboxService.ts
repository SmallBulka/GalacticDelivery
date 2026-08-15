import { Scene, CubeTexture } from "@babylonjs/core";

export interface ISkyboxConfig {
  rootPath: string;
  size?: number;
}

export class SpaceSkyboxService {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public createSkybox(config: ISkyboxConfig): void {
    const size = config.size ?? 1000;
    const skyboxTexture = new CubeTexture(
      config.rootPath,
      this.scene,
      ["_px", "_py", "_pz", "_nx", "_ny", "_nz"]
    );

    this.scene.createDefaultSkybox(skyboxTexture, true, size);
    this.scene.environmentTexture = skyboxTexture;
  }
}
