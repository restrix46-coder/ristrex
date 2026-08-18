import { EventEmitter } from 'events';

export type EventType =
  | 'TaskCreated'
  | 'AgentStarted'
  | 'ToolCalled'
  | 'FileChanged'
  | 'TestFailed'
  | 'TestPassed'
  | 'DeploymentStarted'
  | 'DeploymentCompleted'
  | 'DeploymentFailed'
  | 'MessageSent'
  | 'ProjectCreated'
  | 'SecurityAlert'
  | 'BudgetExceeded'
  | 'RateLimitHit';

export interface EventPayloadMap {
  TaskCreated: { taskId: string; title: string; projectId: string };
  AgentStarted: { agentId: string; type: string };
  ToolCalled: { toolName: string; args: unknown; durationMs?: number };
  FileChanged: { filePath: string; action: 'created' | 'modified' | 'deleted' };
  TestFailed: { testName: string; error: string };
  TestPassed: { testName: string; durationMs: number };
  DeploymentStarted: { projectId: string; environment: string };
  DeploymentCompleted: { projectId: string; url: string };
  DeploymentFailed: { projectId: string; reason: string };
  MessageSent: { messageId: string; recipient: string; sizeBytes: number };
  ProjectCreated: { projectId: string; name: string };
  SecurityAlert: { severity: 'low' | 'medium' | 'high' | 'critical'; description: string };
  BudgetExceeded: { projectId: string; estimatedCostUsd: number; limitUsd: number };
  RateLimitHit: { endpoint: string; ip: string; limit: number };
}

interface HistoricalEvent {
  type: EventType;
  payload: any;
  timestamp: Date;
}

class TypedEventBus extends EventEmitter {
  private history: HistoricalEvent[] = [];
  private readonly MAX_HISTORY = 100;

  public typedEmit<K extends EventType>(event: K, payload: EventPayloadMap[K]): boolean {
    this.history.push({ type: event, payload, timestamp: new Date() });
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
    return super.emit(event, payload);
  }

  public typedOn<K extends EventType>(event: K, listener: (payload: EventPayloadMap[K]) => void): this {
    return super.on(event, listener);
  }

  public typedOff<K extends EventType>(event: K, listener: (payload: EventPayloadMap[K]) => void): this {
    return super.off(event, listener);
  }

  public getEventHistory(): HistoricalEvent[] {
    return [...this.history];
  }

  public clearEventHistory(): void {
    this.history = [];
  }
}

/**
 * Singleton typed event bus instance
 */
export const eventBus = new TypedEventBus();

/**
 * Emit a typed event
 * @param event Event type
 * @param payload Event payload
 */
export function emit<K extends EventType>(event: K, payload: EventPayloadMap[K]): boolean {
  return eventBus.typedEmit(event, payload);
}

/**
 * Listen to a typed event
 * @param type Event type
 * @param handler Event handler
 */
export function on<K extends EventType>(type: K, handler: (payload: EventPayloadMap[K]) => void): void {
  eventBus.typedOn(type, handler);
}

/**
 * Stop listening to a typed event
 * @param type Event type
 * @param handler Event handler
 */
export function off<K extends EventType>(type: K, handler: (payload: EventPayloadMap[K]) => void): void {
  eventBus.typedOff(type, handler);
}

/**
 * Get event history
 */
export function getEventHistory(): HistoricalEvent[] {
  return eventBus.getEventHistory();
}

/**
 * Clear event history
 */
export function clearEventHistory(): void {
  eventBus.clearEventHistory();
}
