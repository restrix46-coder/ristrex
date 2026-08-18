export class BulkheadRejectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadRejectError';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadTimeoutError';
  }
}

export interface BulkheadConfig {
  name: string;
  maxConcurrent: number;
  maxQueueSize: number;
  timeout: number;
  category: 'database' | 'external_api' | 'ai_model' | 'file_system' | 'agent' | 'custom';
}

export interface BulkheadStats {
  name: string;
  activeCalls: number;
  queuedCalls: number;
  totalExecuted: number;
  totalRejected: number;
  totalTimeout: number;
  successRate: number;
}

export class Bulkhead {
  private active = 0;
  private queue: Array<() => void> = [];
  
  private stats = {
    totalExecuted: 0,
    totalRejected: 0,
    totalTimeout: 0,
    totalSuccess: 0
  };

  constructor(private config: BulkheadConfig) {}

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.config.maxConcurrent) {
      if (this.queue.length >= this.config.maxQueueSize) {
        this.stats.totalRejected++;
        throw new BulkheadRejectError(`Bulkhead ${this.config.name} queue is full.`);
      }

      await new Promise<void>(resolve => {
        this.queue.push(resolve);
      });
    }

    this.active++;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stats.totalTimeout++;
        this.dequeue();
        reject(new BulkheadTimeoutError(`Bulkhead ${this.config.name} execution timed out.`));
      }, this.config.timeout);

      fn().then(result => {
        clearTimeout(timer);
        this.stats.totalSuccess++;
        this.stats.totalExecuted++;
        this.dequeue();
        resolve(result);
      }).catch(err => {
        clearTimeout(timer);
        this.stats.totalExecuted++;
        this.dequeue();
        reject(err);
      });
    });
  }

  private dequeue() {
    this.active--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  public getStats(): BulkheadStats {
    const successRate = this.stats.totalExecuted > 0 
      ? this.stats.totalSuccess / this.stats.totalExecuted 
      : 1;

    return {
      name: this.config.name,
      activeCalls: this.active,
      queuedCalls: this.queue.length,
      totalExecuted: this.stats.totalExecuted,
      totalRejected: this.stats.totalRejected,
      totalTimeout: this.stats.totalTimeout,
      successRate
    };
  }

  public resetStats() {
    this.stats = { totalExecuted: 0, totalRejected: 0, totalTimeout: 0, totalSuccess: 0 };
  }
}

export class BulkheadRegistry {
  private bulkheads = new Map<string, Bulkhead>();

  constructor() {
    this.create({ name: 'database', maxConcurrent: 20, maxQueueSize: 100, timeout: 5000, category: 'database' });
    this.create({ name: 'external_api', maxConcurrent: 10, maxQueueSize: 50, timeout: 10000, category: 'external_api' });
    this.create({ name: 'ai_model', maxConcurrent: 5, maxQueueSize: 20, timeout: 60000, category: 'ai_model' });
    this.create({ name: 'file_system', maxConcurrent: 30, maxQueueSize: 100, timeout: 2000, category: 'file_system' });
  }

  public create(config: BulkheadConfig): Bulkhead {
    const bulkhead = new Bulkhead(config);
    this.bulkheads.set(config.name, bulkhead);
    return bulkhead;
  }

  public get(name: string): Bulkhead | undefined {
    return this.bulkheads.get(name);
  }

  public getAllStats(): BulkheadStats[] {
    return Array.from(this.bulkheads.values()).map(b => b.getStats());
  }

  public resetAll(): void {
    for (const bulkhead of this.bulkheads.values()) {
      bulkhead.resetStats();
    }
  }
}

export const bulkheadRegistry = new BulkheadRegistry();
