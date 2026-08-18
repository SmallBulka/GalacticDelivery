import { IInputState } from "./IInputState";

//Источник нормализованного ввода (−1…1). Скорости полёта задаются в FlightSettingsConfig.
export interface IInputProvider {
  getInput(): IInputState;
}
