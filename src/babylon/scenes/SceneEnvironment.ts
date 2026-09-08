import {
  BackgroundMaterial,
  CubeTexture,
  HemisphericLight,
  MeshBuilder,
  PointLight,
  Scene,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { WORLD_SIZE, WorldBounds } from "../world/WorldBounds";

/**
 * Статическое окружение сцены: свет, skybox, границы мира.
 */
export const SceneEnvironment = {
  createLights(scene: Scene): void {
    new HemisphericLight("light1", new Vector3(1, 1, 0), scene);
    new PointLight("pointLight", new Vector3(100, 100, 100), scene);
  },

  createSkybox(scene: Scene): void {
    const skyboxTexture = new CubeTexture(
      "./textures/skybox/space",
      scene,
      ["_px.png", "_py.png", "_pz.png", "_nx.png", "_ny.png", "_nz.png"]
    );

    const skybox = MeshBuilder.CreateBox("skyBox", { size: 8000 }, scene);
    const skyboxMaterial = new BackgroundMaterial("skyBoxMaterial", scene);
    skyboxMaterial.reflectionTexture = skyboxTexture;
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.backFaceCulling = false;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skybox.ignoreCameraMaxZ = true;
    skybox.isPickable = false;

    scene.environmentTexture = skyboxTexture;
  },

  createWorldBounds(scene: Scene): void {
    const bounds = new WorldBounds(scene, WORLD_SIZE);
    bounds.createWalls();
  },
} as const;
