import { IInputProvider } from "./IInputProvider";
import { IInputState } from "./IInputState";

/**
 * Складывает оси нескольких провайдеров и ограничивает результат диапазоном −1…1.
 * Не хранит настройки полёта — только нормализованный ввод.
 */
export class CompositeInputProvider implements IInputProvider {
  constructor(private readonly providers: IInputProvider[]) {}

  public getInput(): IInputState {
    const combined: IInputState = { thrust: 0, yaw: 0, pitch: 0, roll: 0 };

    for (const provider of this.providers) {
      const input = provider.getInput();
      combined.thrust = this.clamp(combined.thrust + input.thrust);
      combined.yaw = this.clamp(combined.yaw + input.yaw);
      combined.pitch = this.clamp(combined.pitch + input.pitch);
      combined.roll = this.clamp(combined.roll + input.roll);
    }

    return combined;
  }

  private clamp(val: number): number {
    return Math.max(-1, Math.min(1, val));
  }
}
