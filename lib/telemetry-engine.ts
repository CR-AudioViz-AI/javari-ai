/** Telemetry Engine v1 */
import EventEmitter from 'events';

export type TelemetryEvent =
  | { type: 'heartbeat'; taskId: string; message: string; timestamp: string }
  | { type: 'modeChange'; mode: string; timestamp: string }
  | { type: 'progress'; taskId: string; percent: number; timestamp: string }
  | { type: 'failover'; newMode: 'RECOVER_MODE'; timestamp: string };

class TelemetryEngine extends EventEmitter {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private failoverTimeout: NodeJS.Timeout | null = null;

  start() {
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.emitHeartbeat('system', 'Automatic heartbeat');
      }, 120000);
    }
    this.resetFailover();
  }

  emitHeartbeat(taskId: string, message: string) {
    this.emitEvent({
      type: 'heartbeat',
      taskId,
      message,
      timestamp: new Date().toISOString(),
    });
    this.resetFailover();
  }

  emitModeChange(mode: string) {
    this.emitEvent({
      type: 'modeChange',
      mode,
      timestamp: new Date().toISOString(),
    });
  }

  emitProgress(taskId: string, percent: number) {
    this.emitEvent({
      type: 'progress',
      taskId,
      percent,
      timestamp: new Date().toISOString(),
    });
  }

  private emitEvent(event: TelemetryEvent) {
    this.emit('telemetry', event);
  }

  private triggerFailover() {
    this.emitEvent({
      type: 'failover',
      newMode: 'RECOVER_MODE',
      timestamp: new Date().toISOString(),
    });
  }

  private resetFailover() {
    if (this.failoverTimeout) clearTimeout(this.failoverTimeout);
    this.failoverTimeout = setTimeout(() => {
      this.triggerFailover();
    }, 180000);
  }
}

const telemetryEngine = new TelemetryEngine();
export default telemetryEngine;
