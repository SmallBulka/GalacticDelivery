import { Vector3 } from "@babylonjs/core";
import { QuestId } from "./QuestTypes";

export interface QuestCompletionRecord {
  questId: QuestId;
  title: string;
  elapsedSeconds: number;
  cleanliness: number;
  detail?: string;
}

export class QuestStats {
  private sessionStart = 0;
  private totalDistance = 0;
  private lastShipPos?: Vector3;
  private globalCleanliness = 100;
  private readonly completed: QuestCompletionRecord[] = [];

  beginSession(): void {
    this.sessionStart = performance.now() / 1000;
  }

  updateDistance(shipPos: Vector3): void {
    if (this.lastShipPos) {
      this.totalDistance += Vector3.Distance(this.lastShipPos, shipPos);
    }
    this.lastShipPos = shipPos.clone();
  }

  applyPenalty(amount: number): void {
    this.globalCleanliness = Math.max(0, this.globalCleanliness - amount);
  }

  recordQuestCompletion(record: QuestCompletionRecord): void {
    this.completed.push(record);
    const avgQuestClean =
      this.completed.reduce((sum, q) => sum + q.cleanliness, 0) /
      this.completed.length;
    this.globalCleanliness = Math.round(avgQuestClean);
  }

  getElapsedSeconds(): number {
    if (this.sessionStart <= 0) return 0;
    return performance.now() / 1000 - this.sessionStart;
  }

  getTotalDistance(): number {
    return this.totalDistance;
  }

  getGlobalCleanliness(): number {
    return Math.round(this.globalCleanliness);
  }

  getCompletedQuests(): readonly QuestCompletionRecord[] {
    return this.completed;
  }

  isAllQuestsComplete(totalQuests: number): boolean {
    return this.completed.length >= totalQuests;
  }

  formatDistance(): string {
    if (this.totalDistance >= 1000) {
      return `${(this.totalDistance / 1000).toFixed(1)} км`;
    }
    return `${Math.round(this.totalDistance)} м`;
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}
