import { PhysicsAggregate, Scene, Vector3 } from "@babylonjs/core";
import { getActiveAudioManager } from "../audio/AudioManager";
import { Planet } from "../planets/Planet";
import { PlanetManager } from "../planets/PlanetManager";
import {
  GameCompletionUI,
  PackageChoiceDialogUI,
  QuestDialogUI,
  QuestHudUI,
  ScanProgressUI,
} from "../gui/QuestUI";
import { QuestListItemState } from "../gui/QuestSwitcherUI";
import { RingCheckpointField } from "./RingCheckpointField";
import { ScanZone } from "./ScanZone";
import { QuestStats } from "./QuestStats";
import { TargetWaypointIndicator } from "./TargetWaypointIndicator";
import {
  ALL_QUESTS,
  COURIER_DELIVERY_QUEST,
  ORBIT_SCANNER_QUEST,
  PackageType,
  QuestId,
  QuestPhase,
  RING_RUNNER_QUEST,
} from "./QuestTypes";

const MARKER_RADIUS = 3500;
const DELIVERY_DISTANCE = 180;
const FRAGILE_SPEED_LIMIT = 75;
/**
 * После взятия посылки не считаем удары/манёвры несколько секунд —
 * иначе срабатывают контакты с планетой выдачи и обычный поворот.
 */
const FRAGILE_PICKUP_GRACE_SEC = 2.5;
/** Резкий манёвр: мгновенный разворот курса (dot направлений скорости). */
const FRAGILE_HEADING_DOT_MIN = 0.82;
const FRAGILE_MANEUVER_MIN_SPEED = 45;
const FRAGILE_DAMAGE_TOAST =
  "Груз поврежден, вернитесь и возьмите новый";

export interface QuestUIBundle {
  questDialog: QuestDialogUI;
  scanProgress: ScanProgressUI;
  packageChoice: PackageChoiceDialogUI;
  questHud: QuestHudUI;
  completionScreen: GameCompletionUI;
}

const BUSY_PHASES = new Set<QuestPhase>([
  QuestPhase.Active,
  QuestPhase.Scanning,
  QuestPhase.PackageChoice,
  QuestPhase.Dialog,
]);

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

  private selectedQuestId: QuestId = "orbit_scanner";
  private scanZone?: ScanZone;
  private ringField?: RingCheckpointField;
  private waypoint!: TargetWaypointIndicator;
  private scanProgress = 0;
  private questCleanliness = 100;
  private scanResets = 0;

  private ringTimer = 0;

  private packageType?: PackageType;
  private courierTimer = 0;
  private fragileSpeedViolations = 0;
  /** Секунды до конца иммунитета после взятия хрупкой посылки. */
  private fragileGraceRemaining = 0;
  private fragilePrevVelocityDir = new Vector3(0, 0, 1);
  private fragilePrevSpeed = 0;
  private fragileHeadingReady = false;

  private elapsed = 0;
  private insideGiverAtmosphere = false;
  private gameFinished = false;

  constructor(
    private scene: Scene,
    private planetManager: PlanetManager,
    private ui: QuestUIBundle,
    private getShipAggregate: () => PhysicsAggregate | undefined,
    private getShipPosition: () => Vector3,
    private getShipSpeed: () => number,
    private getShipWorldMatrix: () => import("@babylonjs/core").Matrix,
    private onToast: (
      message: string,
      options?: { critical?: boolean; questComplete?: boolean; questTitle?: string }
    ) => void,
    private onQuestListRefresh: (items: QuestListItemState[]) => void
  ) {
    for (const q of ALL_QUESTS) {
      this.phases.set(q.id, QuestPhase.Available);
    }
  }

  initialize(): void {
    this.planets = this.planetManager.createAllQuestPlanets();
    this.stats.beginSession();
    this.waypoint = new TargetWaypointIndicator(this.scene);
    this.selectedQuestId = "orbit_scanner";
    this.activateSelectedMarkers();
    this.refreshList();
    this.updateCompassTarget();
  }

  getStats(): QuestStats {
    return this.stats;
  }

  /** Переключение активного задания из UI. */
  selectQuest(id: QuestId): void {
    if (this.gameFinished) return;
    if (this.getPhase(id) === QuestPhase.Completed) return;

    const current = this.selectedQuestId;
    if (current === id) return;

    if (BUSY_PHASES.has(this.getPhase(current))) {
      this.onToast("Сначала завершите или отмените текущее задание");
      return;
    }

    this.insideGiverAtmosphere = false;
    this.selectedQuestId = id;
    this.activateSelectedMarkers();
    this.refreshList();
    this.updateCompassTarget();
  }

  update(deltaTime: number): void {
    if (this.gameFinished) {
      this.waypoint.clear();
      return;
    }

    this.elapsed += deltaTime;
    const shipPos = this.getShipPosition();
    this.stats.updateDistance(shipPos);

    this.planetManager.updateQuestMarkers(
      this.elapsed,
      shipPos,
      MARKER_RADIUS
    );

    this.updateQuestMarkersVisibility();
    this.updateCompassTarget();
    this.waypoint.update(shipPos, this.getShipWorldMatrix(), this.elapsed);

    const questId = this.selectedQuestId;
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

    this.scanZone?.animate(this.elapsed, phase === QuestPhase.Scanning);
    this.ringField?.animate(this.elapsed);
  }

  private activateSelectedMarkers(): void {
    for (const q of ALL_QUESTS) {
      if (q.id === this.selectedQuestId) continue;
      if (this.getPhase(q.id) !== QuestPhase.Completed) {
        // чужие маркеры скрываем через updateQuestMarkersVisibility
      }
    }
    const giver = this.getGiverPlanet(this.selectedQuestId);
    if (!giver.getQuestRole()) {
      giver.markQuestTarget("giver", this.planetManager.getGlowLayer());
    }
  }

  private refreshList(): void {
    const items: QuestListItemState[] = ALL_QUESTS.map((q) => ({
      id: q.id,
      title: q.title,
      phase: this.getPhase(q.id),
      selected: q.id === this.selectedQuestId,
    }));
    this.onQuestListRefresh(items);
  }

  private updateCompassTarget(): void {
    const target = this.getWaypointWorldPos();
    this.waypoint.setTarget(target);
  }

  private getWaypointWorldPos(): Vector3 | null {
    const id = this.selectedQuestId;
    const phase = this.getPhase(id);
    if (phase === QuestPhase.Completed) return null;

    switch (id) {
      case "orbit_scanner":
        if (phase === QuestPhase.Active || phase === QuestPhase.Scanning) {
          return this.scanZone?.center.clone() ?? this.planets.scannerTarget.position.clone();
        }
        return this.planets.scannerGiver.position.clone();
      case "ring_runner":
        if (phase === QuestPhase.Active && this.ringField) {
          // кольца — летим к планете-якорю (кольца рядом)
          return this.planets.ringGiver.position.clone();
        }
        return this.planets.ringGiver.position.clone();
      case "courier_delivery":
        if (phase === QuestPhase.Active) {
          return this.planets.courierDelivery.position.clone();
        }
        return this.planets.courierPickup.position.clone();
    }
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
    this.playQuestStartSfx();

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
    this.refreshList();
    this.updateCompassTarget();
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
      this.refreshList();
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
        this.refreshList();
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
    }
  }

  private acceptRingRunner(): void {
    this.setPhase("ring_runner", QuestPhase.Active);
    this.questCleanliness = 100;
    this.ringTimer = RING_RUNNER_QUEST.ringTimeLimitSeconds ?? 30;
    this.playQuestStartSfx();

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
    this.refreshList();
    this.updateCompassTarget();
  }

  private updateRingActive(shipPos: Vector3, dt: number): void {
    if (!this.ringField) return;

    this.ringTimer -= dt;
    if (this.ringField.tryPassRing(shipPos)) {
      getActiveAudioManager()?.playSfx("ring_pass");
    }

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
      this.setPhase("ring_runner", QuestPhase.Available);
      this.ui.questHud.setVisible(false);
      this.ringField.setVisible(false);
      this.onToast("Время вышло! Подлетите снова к Нова-Ринг.");
      this.insideGiverAtmosphere = false;
      this.ringField.dispose();
      this.ringField = undefined;
      this.refreshList();
      this.updateCompassTarget();
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
    this.refreshList();
    this.ui.packageChoice.show(
      () => this.startCourier("simple"),
      () => this.startCourier("fragile"),
      () => {
        this.setPhase("courier_delivery", QuestPhase.Available);
        this.refreshList();
      }
    );
  }

  private startCourier(type: PackageType): void {
    this.packageType = type;
    this.questCleanliness = 100;
    this.fragileSpeedViolations = 0;
    this.fragileGraceRemaining =
      type === "fragile" ? FRAGILE_PICKUP_GRACE_SEC : 0;
    this.fragileHeadingReady = false;
    this.fragilePrevSpeed = 0;
    this.courierTimer =
      type === "fragile"
        ? COURIER_DELIVERY_QUEST.fragileDeliverySeconds ?? 120
        : 0;
    this.playQuestStartSfx();

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

    this.refreshList();
    this.updateCompassTarget();
  }

  /** Сильный удар: хрупкий груз провален (после grace-периода). */
  notifyStrongImpact(): void {
    if (this.getPhase("courier_delivery") !== QuestPhase.Active) return;
    if (this.packageType !== "fragile") return;
    if (this.fragileGraceRemaining > 0) return;
    this.failFragileCargo();
  }

  private updateCourierDelivery(shipPos: Vector3, dt: number): void {
    if (this.packageType === "fragile") {
      if (this.fragileGraceRemaining > 0) {
        this.fragileGraceRemaining = Math.max(0, this.fragileGraceRemaining - dt);
      }

      if (
        this.fragileGraceRemaining <= 0 &&
        this.isSharpFragileManeuver()
      ) {
        this.failFragileCargo();
        return;
      }

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
        this.failFragileCargo();
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

  /**
   * Резкий манёвр = мгновенный скачок курса (как от удара/рывка),
   * а не обычный поворот стиком.
   */
  private isSharpFragileManeuver(): boolean {
    const body = this.getShipAggregate()?.body;
    if (!body) return false;

    const velocity = body.getLinearVelocity();
    const speed = velocity.length();

    if (speed < 1) {
      this.fragileHeadingReady = false;
      this.fragilePrevSpeed = speed;
      return false;
    }

    const dir = velocity.scale(1 / speed);
    if (!this.fragileHeadingReady) {
      this.fragilePrevVelocityDir.copyFrom(dir);
      this.fragilePrevSpeed = speed;
      this.fragileHeadingReady = true;
      return false;
    }

    const headingDot = Vector3.Dot(this.fragilePrevVelocityDir, dir);
    const wasFast =
      this.fragilePrevSpeed >= FRAGILE_MANEUVER_MIN_SPEED &&
      speed >= FRAGILE_MANEUVER_MIN_SPEED * 0.55;
    this.fragilePrevVelocityDir.copyFrom(dir);
    this.fragilePrevSpeed = speed;

    // ~35°+ за один кадр при высокой скорости — недостижимо нормальным управлением
    return wasFast && headingDot < FRAGILE_HEADING_DOT_MIN;
  }

  private failFragileCargo(): void {
    if (this.getPhase("courier_delivery") !== QuestPhase.Active) return;
    if (this.packageType !== "fragile") return;

    this.packageType = undefined;
    this.courierTimer = 0;
    this.fragileSpeedViolations = 0;
    this.fragileGraceRemaining = 0;
    this.fragileHeadingReady = false;
    this.questCleanliness = 20;
    this.setPhase("courier_delivery", QuestPhase.Available);
    this.insideGiverAtmosphere = false;
    this.planets.courierDelivery.setQuestMarkerVisible(false);
    this.refreshList();
    this.updateCompassTarget();
    this.onToast(FRAGILE_DAMAGE_TOAST, { critical: true });
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

    this.onToast("", { questComplete: true, questTitle: title });

    const nextIncomplete = ALL_QUESTS.find(
      (q) => this.getPhase(q.id) !== QuestPhase.Completed
    );

    if (!nextIncomplete) {
      this.gameFinished = true;
      this.waypoint.clear();
      this.refreshList();
      this.ui.completionScreen.show({
        time: this.stats.formatTime(this.stats.getElapsedSeconds()),
        distance: this.stats.formatDistance(),
        cleanliness: this.stats.getGlobalCleanliness(),
        quests: this.stats.getCompletedQuests(),
      });
      return;
    }

    this.selectedQuestId = nextIncomplete.id;
    this.insideGiverAtmosphere = false;
    this.activateSelectedMarkers();
    this.refreshList();
    this.updateCompassTarget();
  }

  private tryOpenDialog(
    planet: Planet,
    quest: { title: string; description: string },
    destinationName: string,
    onAccept: () => void
  ): void {
    const shipPos = this.getShipPosition();
    const dist = Vector3.Distance(shipPos, planet.position);
    const atmosphereRadius = planet.getAtmosphereRadius();
    const inside = dist <= atmosphereRadius;

    const questId = this.selectedQuestId;

    if (!inside) {
      this.insideGiverAtmosphere = false;
      if (this.getPhase(questId) === QuestPhase.Dialog) {
        this.ui.questDialog.hide();
        this.setPhase(questId, QuestPhase.Available);
        this.refreshList();
      }
      return;
    }

    if (this.insideGiverAtmosphere) return;
    this.insideGiverAtmosphere = true;

    if (this.getPhase(questId) !== QuestPhase.Available) return;
    if (this.ui.questDialog.isOpen() || this.ui.packageChoice.isOpen()) return;

    this.setPhase(questId, QuestPhase.Dialog);
    this.refreshList();

    this.ui.questDialog.show(
      {
        title: quest.title,
        description: quest.description,
        destinationName,
      },
      onAccept,
      () => {
        this.setPhase(questId, QuestPhase.Available);
        this.refreshList();
      }
    );
  }

  private updateQuestMarkersVisibility(): void {
    const all = [
      this.planets.scannerGiver,
      this.planets.scannerTarget,
      this.planets.ringGiver,
      this.planets.courierPickup,
      this.planets.courierDelivery,
    ];

    for (const p of all) {
      p.setQuestMarkerVisible(false);
    }

    const id = this.selectedQuestId;
    const phase = this.getPhase(id);
    if (phase === QuestPhase.Completed) return;

    if (id === "orbit_scanner") {
      if (phase === QuestPhase.Available || phase === QuestPhase.Dialog) {
        this.planets.scannerGiver.setQuestMarkerVisible(true);
      }
      if (phase === QuestPhase.Active || phase === QuestPhase.Scanning) {
        this.planets.scannerTarget.setQuestMarkerVisible(true);
      }
    }
    if (id === "ring_runner") {
      this.planets.ringGiver.setQuestMarkerVisible(true);
    }
    if (id === "courier_delivery") {
      if (
        phase === QuestPhase.Available ||
        phase === QuestPhase.Dialog ||
        phase === QuestPhase.PackageChoice
      ) {
        this.planets.courierPickup.setQuestMarkerVisible(true);
      }
      if (phase === QuestPhase.Active) {
        this.planets.courierDelivery.setQuestMarkerVisible(true);
      }
    }
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

  private getPhase(id: QuestId): QuestPhase {
    return this.phases.get(id) ?? QuestPhase.Locked;
  }

  private setPhase(id: QuestId, phase: QuestPhase): void {
    this.phases.set(id, phase);
  }

  private playQuestStartSfx(): void {
    getActiveAudioManager()?.playSfx("quest_start");
  }
}
