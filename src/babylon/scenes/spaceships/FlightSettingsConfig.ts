/**
 * Тюнинг полёта. Единственное место с числовыми дефолтами скорости/damping.
 * Провайдеры ввода (клавиатура/геймпад) отдают только оси −1…1.
 */
export interface FlightSettingsConfig {
  maxSpeed: number;
  thrustAcceleration: number;
  rotationSpeed: number;
  linearDamping: number;
  angularDamping: number;
}

export const DEFAULT_FLIGHT_SETTINGS: FlightSettingsConfig = {
  maxSpeed: 100,
  thrustAcceleration: 20,
  rotationSpeed: 0.5,
  linearDamping: 0.95,
  angularDamping: 0.8,
};

export function mergeFlightSettings(
  partial?: Partial<FlightSettingsConfig>
): FlightSettingsConfig {
  return { ...DEFAULT_FLIGHT_SETTINGS, ...partial };
}
