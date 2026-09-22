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
  maxSpeed: 135,
  thrustAcceleration: 30,
  rotationSpeed: 0.5,
  linearDamping: 0.95,
  angularDamping: 0.8,
};

const STORAGE_KEY = "galacticDelivery.flightSettings";

const CLAMP: Record<
  keyof FlightSettingsConfig,
  { min: number; max: number }
> = {
  maxSpeed: { min: 30, max: 300 },
  thrustAcceleration: { min: 7, max: 70 },
  rotationSpeed: { min: 0.1, max: 2 },
  linearDamping: { min: 0.5, max: 0.99 },
  angularDamping: { min: 0.5, max: 0.99 },
};

function clampSetting(
  key: keyof FlightSettingsConfig,
  value: number
): number {
  const { min, max } = CLAMP[key];
  if (!Number.isFinite(value)) return DEFAULT_FLIGHT_SETTINGS[key];
  return Math.max(min, Math.min(max, value));
}

export function mergeFlightSettings(
  partial?: Partial<FlightSettingsConfig>
): FlightSettingsConfig {
  const merged = { ...DEFAULT_FLIGHT_SETTINGS, ...partial };
  return {
    maxSpeed: clampSetting("maxSpeed", merged.maxSpeed),
    thrustAcceleration: clampSetting(
      "thrustAcceleration",
      merged.thrustAcceleration
    ),
    rotationSpeed: clampSetting("rotationSpeed", merged.rotationSpeed),
    linearDamping: clampSetting("linearDamping", merged.linearDamping),
    angularDamping: clampSetting("angularDamping", merged.angularDamping),
  };
}

/** Загрузка сохранённых настроек корабля из localStorage. */
export function loadFlightSettings(): FlightSettingsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLIGHT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<FlightSettingsConfig>;
    return mergeFlightSettings(parsed);
  } catch {
    return { ...DEFAULT_FLIGHT_SETTINGS };
  }
}

/** Сохранить настройки корабля. */
export function saveFlightSettings(settings: FlightSettingsConfig): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(mergeFlightSettings(settings))
    );
  } catch {
    /* private mode / quota */
  }
}

/** Сброс к дефолтам и очистка сохранённых значений. */
export function resetFlightSettings(): FlightSettingsConfig {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
  return { ...DEFAULT_FLIGHT_SETTINGS };
}
