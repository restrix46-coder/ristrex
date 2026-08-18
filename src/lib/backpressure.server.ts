import { logger } from '@/lib/logger';

export interface BackpressureConfig {
  name: string;
  maxBufferSize: number;
  processingRateMs: number;
  strategy: 'drop' | 'block' | 'sample' | 'prioritize';
}

export interface BackpressureStats {
  name: string;
  bufferSize: number;
  droppedMessages: number;
  processedMessages: number;
  currentThroughputRps: number;
  isUnderPressure: boolean;
}

interface QueuedItem {
  item: unknown;
  priority: number;
  timestamp: number;
}

/**
 * يتحكم في الضغط الخلفي لمنع استهلاك الموارد المفرط.
 * Backpressure controller to prevent excessive resource consumption.
 */
export class BackpressureController {
  private queue: QueuedItem[] = [];
  private stats: BackpressureStats;
  private config: BackpressureConfig;

  constructor(config: BackpressureConfig) {
    this.config = config;
    this.stats = {
      name: config.name,
      bufferSize: 0,
      droppedMessages: 0,
      processedMessages: 0,
      currentThroughputRps: 0,
      isUnderPressure: false,
    };
  }

  /**
   * Pushes an item to the queue respecting the backpressure strategy.
   */
  async push(item: unknown, priority: number = 0): Promise<boolean> {
    if (this.queue.length >= this.config.maxBufferSize) {
      if (this.config.strategy === 'drop') {
        this.queue.shift(); // Remove oldest
        this.stats.droppedMessages++;
      } else if (this.config.strategy === 'block') {
        await new Promise(resolve => setTimeout(resolve, this.config.processingRateMs));
        if (this.queue.length >= this.config.maxBufferSize) {
          this.stats.droppedMessages++;
          return false;
        }
      } else if (this.config.strategy === 'sample') {
        if (Math.random() > 0.5) {
          this.stats.droppedMessages++;
          return false;
        }
      } else if (this.config.strategy === 'prioritize') {
        const lowestPriorityIndex = this.queue.findIndex(q => q.priority < priority);
        if (lowestPriorityIndex !== -1) {
          this.queue.splice(lowestPriorityIndex, 1);
          this.stats.droppedMessages++;
        } else {
          this.stats.droppedMessages++;
          return false;
        }
      }
    }
    
    this.queue.push({ item, priority, timestamp: Date.now() });
    if (this.config.strategy === 'prioritize') {
      this.queue.sort((a, b) => b.priority - a.priority);
    }
    this.updateStats();
    return true;
  }

  /**
   * Removes an item for processing.
   */
  pop(): unknown | null {
    const item = this.queue.shift();
    if (item) {
      this.stats.processedMessages++;
      this.updateStats();
      return item.item;
    }
    return null;
  }

  /**
   * Returns true if buffer is > 80% full.
   */
  isUnderPressure(): boolean {
    return this.queue.length > this.config.maxBufferSize * 0.8;
  }

  /**
   * Returns current stats.
   */
  getStats(): BackpressureStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Processes all buffered items.
   */
  async drain(): Promise<unknown[]> {
    const items = [];
    while (this.queue.length > 0) {
      const item = this.pop();
      if (item) items.push(item);
    }
    return items;
  }

  private updateStats() {
    this.stats.bufferSize = this.queue.length;
    this.stats.isUnderPressure = this.isUnderPressure();
    // Simplified RPS calculation
    this.stats.currentThroughputRps = this.stats.processedMessages > 0 ? 
      Math.min(1000 / this.config.processingRateMs, this.stats.processedMessages) : 0;
  }
}

/**
 * Registry to manage multiple backpressure controllers.
 */
export class BackpressureRegistry {
  private controllers = new Map<string, BackpressureController>();

  create(config: BackpressureConfig): BackpressureController {
    if (this.controllers.has(config.name)) {
      throw new Error(`Controller ${config.name} already exists`);
    }
    const controller = new BackpressureController(config);
    this.controllers.set(config.name, controller);
    return controller;
  }

  get(name: string): BackpressureController | undefined {
    return this.controllers.get(name);
  }

  getAllStats(): Record<string, BackpressureStats> {
    const allStats: Record<string, BackpressureStats> = {};
    for (const [name, controller] of this.controllers.entries()) {
      allStats[name] = controller.getStats();
    }
    return allStats;
  }
}

export const backpressureRegistry = new BackpressureRegistry();
