import { PhysicsAggregate, Scene, Vector3 } from "@babylonjs/core";
import { Planet } from "../planets/Planet";
import { PlanetManager } from "../planets/PlanetManager";
import {
  GameCompletionUI,
  PackageChoiceDialogUI,
  QuestCompletedListUI,
  QuestDialogUI,
  QuestHudUI,
  ScanProgressUI,
} from "../gui/QuestUI";
import { RingCheckpointField } from "./RingCheckpointField";
import { ScanZone } from "./ScanZone";
import { QuestStats } from "./QuestStats";
import {
  ALL_QUESTS,
  COURIER_DELIVERY_QUEST,
  ORBIT_SCANNER_QUEST,
  PackageType,
  QuestId,
  QuestPhase,
  RING_RUNNER_QUEST,
} from "./QuestTypes";

const APPROACH_DISTANCE = 220;
const MARKER_RADIUS = 3500;
const DIALOG_COOLDOWN = 8;
const DELIVERY_DISTANCE = 180;
const FRAGILE_SPEED_LIMIT = 75;

export interface QuestUIBundle {
  questDialog: QuestDialogUI;
  scanProgress: ScanProgressUI;
  packageChoice: PackageChoiceDialogUI;
  questHud: QuestHudUI;
  completedList: QuestCompletedListUI;
  completionScreen: GameCompletionUI;
}

export class QuestManager {
  private readonly stats = new QuestStats();
  private readonly phases = new Map<QuestId, QuestPhase>();
  private planets!: {
    scannerGiver: Planet;
    scannerTarget: Planet;
    ringGiver: Planet;
    courierPickup: Planet;
    courierDelivery: Planet;
  };

  private currentQuestIndex = 0;
  private scanZone?: ScanZone;
  private ringField?: RingCheckpointField;
  private scanProgress = 0;
  private questCleanliness = 100;
  private scanResets = 0;

  private ringTimer = 0;

  private packageType?: PackageType;
  private courierTimer = 0;
  private fragileSpeedViolations = 0;

  private elapsed = 0;
  private dialogCooldown = 0;
  private dialogDismissed = false;
  private gameFinished = false;

  constructor(
    private scene: Scene,
    private planetManager: PlanetManager,
    private ui: QuestUIBundle,
    private getShipAggregate: () => PhysicsAggregate | undefined,
    private getShipPosition: () => Vector3,
    private getShipSpeed: () => number,
    private onToast: (message: string) => void,
    private onTrackerUpdate: (text: string) => void
  ) {
    for (const q of ALL_QUESTS) {
      this.phases.set(q.id, QuestPhase.Locked);
    }
  }

  initialize(): void {
    this.planets = this.planetManager.createAllQuestPlanets();
    this.stats.beginSession();
    this.setPhase("orbit_scanner", QuestPhase.Available);
    this.planets.scannerGiver.markQuestTarget(
      "giver",
      this.planetManager.getGlowLayer()
    );
    this.updateTracker(
      `Задание 1/3: ${ORBIT_SCANNER_QUEST.title} — ${this.planets.scannerGiver.displayName}`
    );
  }

  getStats(): QuestStats {
    return this.stats;
  }

  showCompletedList(): void {
    this.ui.completedList.show(
      this.stats.getCompletedQuests(),
      (s) => this.stats.formatTime(s)
    );
  }

  update(deltaTime: number): void {
    if (this.gameFinished) return;

    this.elapsed += deltaTime;
    const shipPos = this.getShipPosition();
    this.stats.updateDistance(shipPos);

    this.planetManager.updateQuestMarkers(
      this.elapsed,
      shipPos,
      MARKER_RADIUS
    );

    if (this.dialogCooldown > 0) {
      this.dialogCooldown -= deltaTime;
    }

    this.updateQuestMarkersVisibility();

    const questId = this.getCurrentQuestId();
    if (!questId) return;

    const phase = this.getPhase(questId);

    switch (questId) {
      case "orbit_scanner":
        this.updateScanner(shipPos, deltaTime, phase);
        break;
      case "ring_runner":
        this.updateRingRunner(shipPos, deltaTime, phase);
        break;
      case "courier_delivery":
        this.updateCourier(shipPos, deltaTime, phase);
        break;
    }

    this.scanZone?.animate(
      this.elapsed,
      phase === QuestPhase.Scanning
    );
    this.ringField?.animate(this.elapsed);
  }

  private updateScanner(
    shipPos: Vector3,
    dt: number,
    phase: QuestPhase
  ): void {
    switch (phase) {
      case QuestPhase.Available:
        this.tryOpenDialog(
          this.planets.scannerGiver,
          ORBIT_SCANNER_QUEST,
          this.planets.scannerTarget.displayName,
          () => this.acceptScanner()
        );
        break;
      case QuestPhase.Active:
        this.updateScannerActive(shipPos, dt);
        break;
      case QuestPhase.Scanning:
        this.updateScannerScanning(shipPos, dt);
        break;
    }
  }

  private acceptScanner(): void {
    this.setPhase("orbit_scanner", QuestPhase.Active);
    this.questCleanliness = 100;
    this.scanResets = 0;
    this.dialogDismissed = false;

    this.planets.scannerTarget.markQuestTarget(
      "destination",
      this.planetManager.getGlowLayer()
    );

    const direction = new Vector3(0.35, 0.55, 0.75).normalize();
    this.scanZone = new ScanZone(
      this.scene,
      this.planets.scannerTarget,
      direction,
      this.planetManager.getGlowLayer()
    );
    this.scanZone.setVisible(true);

    this.updateTracker(
      `${ORBIT_SCANNER_QUEST.title} → ${this.planets.scannerTarget.displayName}`
    );
  }

  private updateScannerActive(shipPos: Vector3, dt: number): void {
    this.ui.scanProgress.setVisible(false);
    if (!this.scanZone) return;

    const body = this.getShipAggregate()?.body;
    if (body) {
      this.scanZone.applyPushForce(
        body,
        body.getBoundingBox().centerWorld,
        dt
      );
    }

    if (this.scanZone.containsPoint(shipPos)) {
      this.setPhase("orbit_scanner", QuestPhase.Scanning);
      this.scanProgress = 0;
      this.ui.scanProgress.setVisible(true);
      this.ui.scanProgress.reset();
    }
  }

  private updateScannerScanning(shipPos: Vector3, dt: number): void {
    if (!this.scanZone) return;

    const body = this.getShipAggregate()?.body;
    if (body) {
      this.scanZone.applyPushForce(
        body,
        body.getBoundingBox().centerWorld,
        dt
      );
    }

    const inside = this.scanZone.containsPoint(shipPos);
    if (inside) {
      this.scanProgress += dt / (ORBIT_SCANNER_QUEST.scanDurationSeconds ?? 5);
      this.ui.scanProgress.setProgress(this.scanProgress);
      if (this.scanProgress >= 1) {
        this.finishQuest("orbit_scanner", ORBIT_SCANNER_QUEST.title, "Скан завершён");
      }
    } else {
      this.scanProgress = Math.max(0, this.scanProgress - dt * 0.35);
      this.ui.scanProgress.setProgress(this.scanProgress);
      if (this.scanProgress <= 0) {
        this.scanResets++;
        this.questCleanliness = Math.max(40, 100 - this.scanResets * 12);
        this.setPhase("orbit_scanner", QuestPhase.Active);
        this.ui.scanProgress.setVisible(false);
        this.updateTracker(`${ORBIT_SCANNER_QUEST.title} → найдите зону`);
      }
    }
  }

  private updateRingRunner(
    shipPos: Vector3,
    dt: number,
    phase: QuestPhase
  ): void {
    switch (phase) {
      case QuestPhase.Available:
        this.tryOpenDialog(
          this.planets.ringGiver,
          RING_RUNNER_QUEST,
          "",
          () => this.acceptRingRunner()
        );
        break;
      case QuestPhase.Active:
        this.updateRingActive(shipPos, dt);
        break;
      case QuestPhase.Failed:
        break;
    }
  }

  private acceptRingRunner(): void {
    this.setPhase("ring_runner", QuestPhase.Active);
    this.questCleanliness = 100;
    this.ringTimer = RING_RUNNER_QUEST.ringTimeLimitSeconds ?? 30;

    this.ringField = new RingCheckpointField(
      this.scene,
      this.planets.ringGiver,
      this.planetManager.getGlowLayer()
    );
    this.ringField.setVisible(true);

    this.ui.questHud.setVisible(true);
    this.ui.questHud.setText(
      `Кольца: 0 / ${RING_RUNNER_QUEST.ringCount} | ${Math.ceil(this.ringTimer)}с`
    );
    this.updateTracker(`${RING_RUNNER_QUEST.title} — пролетите 5 колец!`);
  }

  private updateRingActive(shipPos: Vector3, dt: number): void {
    if (!this.ringField) return;

    this.ringTimer -= dt;
    this.ringField.tryPassRing(shipPos);

    const passed = this.ringField.getPassedCount();
    const total = this.ringField.getTotalCount();

    this.ui.questHud.setText(
      `Кольца: ${passed} / ${total} | ${Math.max(0, Math.ceil(this.ringTimer))}с`
    );

    if (this.ringField.isComplete()) {
      this.ui.questHud.setVisible(false);
      this.finishQuest("ring_runner", RING_RUNNER_QUEST.title, "Все кольца пройдены");
      return;
    }

    if (this.ringTimer <= 0) {
      this.questCleanliness = 35;
      this.setPhase("ring_runner", QuestPhase.Failed);
      this.ui.questHud.setVisible(false);
      this.ringField.setVisible(false);
      this.onToast("Время вышло! Подлетите снова к Нова-Ринг.");
      this.setPhase("ring_runner", QuestPhase.Available);
      this.dialogDismissed = false;
      this.ringField.dispose();
      this.ringField = undefined;
    }
  }

  private updateCourier(shipPos: Vector3, dt: number, phase: QuestPhase): void {
    switch (phase) {
      case QuestPhase.Available:
        this.tryOpenDialog(
          this.planets.courierPickup,
          COURIER_DELIVERY_QUEST,
          this.planets.courierDelivery.displayName,
          () => this.openPackageChoice()
        );
        break;
      case QuestPhase.PackageChoice:
        break;
      case QuestPhase.Active:
        this.updateCourierDelivery(shipPos, dt);
        break;
    }
  }

  private openPackageChoice(): void {
    this.setPhase("courier_delivery", QuestPhase.PackageChoice);
    this.ui.packageChoice.show(
      () => this.startCourier("simple"),
      () => this.startCourier("fragile"),
      () => {
        this.setPhase("courier_delivery", QuestPhase.Available);
        this.dialogDismissed = true;
        this.dialogCooldown = DIALOG_COOLDOWN;
      }
    );
  }

  private startCourier(type: PackageType): void {
    this.packageType = type;
    this.questCleanliness = 100;
    this.fragileSpeedViolations = 0;
    this.courierTimer =
      type === "fragile"
        ? COURIER_DELIVERY_QUEST.fragileDeliverySeconds ?? 120
        : 0;

    this.setPhase("courier_delivery", QuestPhase.Active);
    this.planets.courierPickup.setQuestMarkerVisible(false);
    this.planets.courierDelivery.markQuestTarget(
      "destination",
      this.planetManager.getGlowLayer()
    );

    if (type === "fragile") {
      this.ui.questHud.setVisible(true);
      this.ui.questHud.setText(`Хрупкий груз: ${Math.ceil(this.courierTimer)}с`);
    } else {
      this.ui.questHud.setVisible(false);
    }

    this.updateTracker(
      `${COURIER_DELIVERY_QUEST.title} → ${this.planets.courierDelivery.displayName}`
    );
  }

  private updateCourierDelivery(shipPos: Vector3, dt: number): void {
    if (this.packageType === "fragile") {
      this.courierTimer -= dt;
      const speed = this.getShipSpeed();
      if (speed > FRAGILE_SPEED_LIMIT) {
        this.fragileSpeedViolations++;
        if (this.fragileSpeedViolations % 30 === 0) {
          this.questCleanliness = Math.max(30, this.questCleanliness - 8);
        }
      }
      this.ui.questHud.setText(
        `Хрупкий груз: ${Math.max(0, Math.ceil(this.courierTimer))}с`
      );

      if (this.courierTimer <= 0) {
        this.questCleanliness = 20;
        this.ui.questHud.setVisible(false);
        this.onToast("Посылка повреждена! Вернитесь на Станцию Альфа.");
        this.setPhase("courier_delivery", QuestPhase.Available);
        this.dialogDismissed = false;
        this.planets.courierDelivery.setQuestMarkerVisible(false);
        return;
      }
    }

    const dist = Vector3.Distance(shipPos, this.planets.courierDelivery.position);
    if (dist <= DELIVERY_DISTANCE) {
      this.ui.questHud.setVisible(false);
      const detail =
        this.packageType === "fragile"
          ? `Хрупкая посылка, нарушений скорости: ${this.fragileSpeedViolations}`
          : "Обычная посылка";
      this.finishQuest(
        "courier_delivery",
        COURIER_DELIVERY_QUEST.title,
        detail
      );
    }
  }

  private finishQuest(questId: QuestId, title: string, detail: string): void {
    this.setPhase(questId, QuestPhase.Completed);

    if (questId === "orbit_scanner") {
      this.ui.scanProgress.showComplete();
      this.scanZone?.setVisible(false);
      setTimeout(() => this.ui.scanProgress.setVisible(false), 2500);
    }

    if (questId === "ring_runner") {
      this.ringField?.setVisible(false);
      this.ringField?.dispose();
      this.ringField = undefined;
    }

    if (questId === "courier_delivery") {
      this.planets.courierDelivery.setQuestMarkerVisible(false);
    }

    this.stats.recordQuestCompletion({
      questId,
      title,
      elapsedSeconds: this.stats.getElapsedSeconds(),
      cleanliness: this.questCleanliness,
      detail,
    });

    this.onToast(`${title} — выполнено!`);
    this.currentQuestIndex++;

    if (this.currentQuestIndex >= ALL_QUESTS.length) {
      this.gameFinished = true;
      this.updateTracker("Все задания выполнены!");
      this.ui.completionScreen.show({
        time: this.stats.formatTime(this.stats.getElapsedSeconds()),
        distance: this.stats.formatDistance(),
        cleanliness: this.stats.getGlobalCleanliness(),
        quests: this.stats.getCompletedQuests(),
      });
      return;
    }

    const next = ALL_QUESTS[this.currentQuestIndex];
    this.setPhase(next.id, QuestPhase.Available);
    this.dialogDismissed = false;

    const giver = this.getGiverPlanet(next.id);
    giver.markQuestTarget("giver", this.planetManager.getGlowLayer());

    this.updateTracker(
      `Задание ${this.currentQuestIndex + 1}/3: ${next.title} — ${giver.displayName}`
    );
  }

  private tryOpenDialog(
    planet: Planet,
    quest: { title: string; description: string },
    destinationName: string,
    onAccept: () => void
  ): void {
    const dist = Vector3.Distance(this.getShipPosition(), planet.position);
    if (
      dist <= APPROACH_DISTANCE &&
      !this.ui.questDialog.isOpen() &&
      !this.ui.packageChoice.isOpen() &&
      !this.dialogDismissed &&
      this.dialogCooldown <= 0
    ) {
      const questId = this.getCurrentQuestId();
      if (questId) this.setPhase(questId, QuestPhase.Dialog);

      this.ui.questDialog.show(
        {
          title: quest.title,
          description: quest.description,
          destinationName,
        },
        onAccept,
        () => {
          if (questId) this.setPhase(questId, QuestPhase.Available);
          this.dialogDismissed = true;
          this.dialogCooldown = DIALOG_COOLDOWN;
        }
      );
    }
  }

  private updateQuestMarkersVisibility(): void {
    const currentId = this.getCurrentQuestId();
    const all = [
      this.planets.scannerGiver,
      this.planets.scannerTarget,
      this.planets.ringGiver,
      this.planets.courierPickup,
      this.planets.courierDelivery,
    ];

    for (const p of all) {
      if (this.getPhaseForPlanet(p) === "active-giver") {
        p.setQuestMarkerVisible(true);
      } else if (this.getPhaseForPlanet(p) === "active-dest") {
        p.setQuestMarkerVisible(true);
      } else {
        p.setQuestMarkerVisible(false);
      }
    }

    if (!currentId) return;

    const phase = this.getPhase(currentId);
    if (phase === QuestPhase.Available || phase === QuestPhase.Dialog) {
      this.getGiverPlanet(currentId).setQuestMarkerVisible(true);
    }
  }

  private getPhaseForPlanet(planet: Planet): "active-giver" | "active-dest" | "none" {
    const id = this.getCurrentQuestId();
    if (!id) return "none";
    const phase = this.getPhase(id);

    if (id === "orbit_scanner") {
      if (planet === this.planets.scannerGiver && (phase === QuestPhase.Available || phase === QuestPhase.Dialog))
        return "active-giver";
      if (planet === this.planets.scannerTarget && (phase === QuestPhase.Active || phase === QuestPhase.Scanning))
        return "active-dest";
    }
    if (id === "ring_runner") {
      if (planet === this.planets.ringGiver && phase !== QuestPhase.Completed)
        return "active-giver";
    }
    if (id === "courier_delivery") {
      if (planet === this.planets.courierPickup && (phase === QuestPhase.Available || phase === QuestPhase.Dialog || phase === QuestPhase.PackageChoice))
        return "active-giver";
      if (planet === this.planets.courierDelivery && phase === QuestPhase.Active)
        return "active-dest";
    }
    return "none";
  }

  private getGiverPlanet(id: QuestId): Planet {
    switch (id) {
      case "orbit_scanner":
        return this.planets.scannerGiver;
      case "ring_runner":
        return this.planets.ringGiver;
      case "courier_delivery":
        return this.planets.courierPickup;
    }
  }

  private getCurrentQuestId(): QuestId | null {
    if (this.currentQuestIndex >= ALL_QUESTS.length) return null;
    return ALL_QUESTS[this.currentQuestIndex].id;
  }

  private getPhase(id: QuestId): QuestPhase {
    return this.phases.get(id) ?? QuestPhase.Locked;
  }

  private setPhase(id: QuestId, phase: QuestPhase): void {
    this.phases.set(id, phase);
  }

  private updateTracker(text: string): void {
    this.onTrackerUpdate(text);
  }
}
