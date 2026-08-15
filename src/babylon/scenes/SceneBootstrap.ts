export type StatusCallback = (text: string) => void;

export interface SceneBootstrapContext {
  calculateDeltaTime: () => void;
  createShip: () => Promise<void>;
  createInitialPlanets: () => Promise<void>;
  initGameUI: () => void;
  generateBoxes: () => void;
  updateChunks: () => void;
  setupRenderHooks: () => void;
  initAsteroids: (
    onProgress: (done: number, total: number) => void
  ) => Promise<void>;
  applyGravity: () => void;
  maybeShowInspector: () => void;
}

/**
 * Оркестратор стартовой загрузки мира со статусами для loading screen.
 */
export class SceneBootstrap {
  constructor(
    private setStatus: StatusCallback,
    private ctx: SceneBootstrapContext
  ) {}

  async run(): Promise<void> {
    this.ctx.calculateDeltaTime();

    this.setStatus("Загрузка корабля...");
    await this.ctx.createShip();

    this.setStatus("Генерация планет...");
    await this.ctx.createInitialPlanets();

    this.setStatus("Интерфейс...");
    this.ctx.initGameUI();

    this.setStatus("Размещение грузов...");
    this.ctx.generateBoxes();
    this.ctx.updateChunks();
    this.ctx.setupRenderHooks();

    this.setStatus("Астероиды: 0 / …");
    await this.ctx.initAsteroids((done, total) => {
      this.setStatus(`Астероиды: ${done} / ${total}`);
    });

    this.ctx.applyGravity();
    this.ctx.maybeShowInspector();

    this.setStatus("Готово");
  }
}
