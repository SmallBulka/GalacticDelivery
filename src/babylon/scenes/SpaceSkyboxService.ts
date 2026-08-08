import { Scene, CubeTexture, Mesh, BackgroundMaterial } from "@babylonjs/core";

export interface IEnvironmentConfig {
    
  /** Путь к папке с текстурами скайбокса или к .hdr/.env файлу */
  skyboxTexturePath: string;
  /** Размер куба скайбокса (по умолчанию 1000) */
  size?: number;
  /** Интенсивность фонового освещения */
  environmentIntensity?: number;
}

export class EnvironmentManager {
  private scene: Scene;
  private skyboxMesh?: Mesh;
  private skyboxTexture?: CubeTexture;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Создание космического скайбокса
   * @param config Настройки текстур и масштаба
   */
  public createSpaceSkybox(config: IEnvironmentConfig): Mesh {
    const size = config.size ?? 1000;

    // 1. Загружаем кубическую текстуру (CubeTexture)
    // Используем явное указание файлов для текстур с именами: back, bottom, front, left, right, top
    this.skyboxTexture = new CubeTexture(
      config.skyboxTexturePath,
      this.scene,
      ["_px", "_py", "_pz", "_nx", "_ny", "_nz"]
    );

    // 2. Создаем скайбокс через встроенный хелпер Babylon.js
    // Это автоматически оптимизирует рендеринг (скайбокс рендерится позади всех объектов)
    this.skyboxMesh = this.scene.createDefaultSkybox(
      this.skyboxTexture,
      true, // Использовать PBR/Background материал
      size,
      0.1   // Blur factor (0 — четкие звезды, 1 — размытый фон)
    ) as Mesh;

    if (!this.skyboxMesh) {
      throw new Error("Не удалось создать Skybox Mesh");
    }

    // 3. Настраиваем текстуру окружения для PBR-материалов (чтобы корабль красиво бликовал)
    this.scene.environmentTexture = this.skyboxTexture;
    if (config.environmentIntensity !== undefined) {
      this.scene.environmentIntensity = config.environmentIntensity;
    }

    return this.skyboxMesh;
  }

  /**
   * Метод для динамической смены скайбокса (например, при переходе в другую галактику)
   */
  public updateSkyboxTexture(newTexturePath: string): void {
    if (this.skyboxTexture) {
      this.skyboxTexture.dispose();
    }
    this.skyboxTexture = new CubeTexture(
      newTexturePath,
      this.scene,
      ["_px", "_py", "_pz", "_nx", "_ny", "_nz"]
    );
    this.scene.environmentTexture = this.skyboxTexture;
    
    if (this.skyboxMesh && this.skyboxMesh.material) {
      // Обновляем текстуру в материале скайбокса
      const backgroundMat = this.skyboxMesh.material as BackgroundMaterial;
      backgroundMat.reflectionTexture = this.skyboxTexture;
    }
  }
}
