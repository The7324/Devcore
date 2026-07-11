import type { HealthStatus } from "@/connections/types";

interface HealthRecord {
  status: HealthStatus;
  lastCheck: string;
  history: HealthCheckEntry[];
}

interface HealthCheckEntry {
  status: HealthStatus;
  timestamp: string;
}

export class HealthTracker {
  private readonly records = new Map<string, HealthRecord>();
  private readonly maxHistory = 50;

  set(connectionId: string, status: HealthStatus): void {
    const existing = this.records.get(connectionId);
    if (existing) {
      existing.status = status;
      existing.lastCheck = new Date().toISOString();
    } else {
      this.records.set(connectionId, {
        status,
        lastCheck: new Date().toISOString(),
        history: [],
      });
    }
  }

  recordCheck(connectionId: string, status: HealthStatus): void {
    const entry: HealthCheckEntry = {
      status,
      timestamp: new Date().toISOString(),
    };

    const existing = this.records.get(connectionId);
    if (existing) {
      existing.status = status;
      existing.lastCheck = entry.timestamp;
      existing.history.push(entry);
      if (existing.history.length > this.maxHistory) {
        existing.history.splice(0, existing.history.length - this.maxHistory);
      }
    } else {
      this.records.set(connectionId, {
        status,
        lastCheck: entry.timestamp,
        history: [entry],
      });
    }
  }

  get(connectionId: string): HealthStatus {
    return this.records.get(connectionId)?.status ?? "unknown";
  }

  getRecord(connectionId: string): HealthRecord | undefined {
    return this.records.get(connectionId);
  }

  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {
      healthy: 0,
      warning: 0,
      error: 0,
      unknown: 0,
    };
    for (const record of this.records.values()) {
      summary[record.status] = (summary[record.status] ?? 0) + 1;
    }
    return summary;
  }

  getHistory(connectionId: string): HealthCheckEntry[] {
    return this.records.get(connectionId)?.history ?? [];
  }

  remove(connectionId: string): void {
    this.records.delete(connectionId);
  }

  clear(): void {
    this.records.clear();
  }
}
