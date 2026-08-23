export type QuestId = "orbit_scanner" | "ring_runner" | "courier_delivery";

export enum QuestPhase {
  Locked = "LOCKED",
  Available = "AVAILABLE",
  Dialog = "DIALOG",
  Active = "ACTIVE",
  Scanning = "SCANNING",
  PackageChoice = "PACKAGE_CHOICE",
  Completed = "COMPLETED",
  Failed = "FAILED",
}

export interface QuestDefinition {
  id: QuestId;
  title: string;
  description: string;
  scanDurationSeconds?: number;
  ringCount?: number;
  ringTimeLimitSeconds?: number;
  fragileDeliverySeconds?: number;
}

export const ORBIT_SCANNER_QUEST: QuestDefinition = {
  id: "orbit_scanner",
  title: "Сканирование атмосферы",
  description:
    "Подлетите к планете назначения и удерживайте корабль в светящейся зоне сканирования 5 секунд. Сканер выталкивает корабль — удерживайте позицию.",
  scanDurationSeconds: 5,
};

export const RING_RUNNER_QUEST: QuestDefinition = {
  id: "ring_runner",
  title: "Гоночный чекпоинт",
  description:
    "Пролетите сквозь 5 светящихся колец за 60 секунд. Кольца появятся вокруг планеты — следуйте по маршруту по порядку.",
  ringCount: 5,
  ringTimeLimitSeconds: 60,
};

export const COURIER_DELIVERY_QUEST: QuestDefinition = {
  id: "courier_delivery",
  title: "Доставка посылки",
  description:
    "Заберите посылку на станции и доставьте на планету назначения. Хрупкий груз нужно доставить быстрее и без резких манёвров.",
  fragileDeliverySeconds: 120,
};

export const ALL_QUESTS: QuestDefinition[] = [
  ORBIT_SCANNER_QUEST,
  RING_RUNNER_QUEST,
  COURIER_DELIVERY_QUEST,
];

export type PackageType = "simple" | "fragile";

export interface QuestPlanetsBundle {
  scannerGiver: import("../planets/Planet").Planet;
  scannerTarget: import("../planets/Planet").Planet;
  ringGiver: import("../planets/Planet").Planet;
  courierPickup: import("../planets/Planet").Planet;
  courierDelivery: import("../planets/Planet").Planet;
}
