import { EventEmitter } from 'events';

export type GlobalBreakerState = 'closed' | 'open' | 'half_open';

export interface BreakerMetrics {
  totalRequests: number;
  failureCount: number;
  successCount: number;
  lastFailureAt?: Date;
  openedAt?: Date;
  state: GlobalBreakerState;
}

/**
 * Global Circuit Breaker — stops all Agent operations when a wide-scope problem is detected.
 */
export class GlobalCircuitBreaker extends EventEmitter {
  private state: GlobalBreakerState = 'closed';
  private metrics: BreakerMetrics = {
    totalRequests: 0,
    failureCount: 0,
    successCount: 0,
    state: 'closed'
  };
  
  private recentResults: boolean[] = [];
  private readonly MAX_RECENT = 100;
  private readonly FAILURE_THRESHOLD = 0.5; // 50%
  private halfOpenTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Records a success or failure
   */
  public record(success: boolean): void {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.failureCount++;
      this.metrics.lastFailureAt = new Date();
    }

    this.recentResults.push(success);
    if (this.recentResults.length > this.MAX_RECENT) {
      this.recentResults.shift();
    }

    this.evaluateState();
  }

  private evaluateState(): void {
    if (this.state === 'open') return;

    if (this.recentResults.length === this.MAX_RECENT) {
      const failures = this.recentResults.filter(r => !r).length;
      const failureRate = failures / this.MAX_RECENT;

      if (failureRate >= this.FAILURE_THRESHOLD) {
        this.openBreaker('Failure rate exceeded 50%');
      }
    } else if (this.state === 'half_open' && this.recentResults.length > 0) {
      const lastResult = this.recentResults[this.recentResults.length - 1];
      if (lastResult) {
        this.forceClose();
      } else {
        this.openBreaker('Failure during half-open state');
      }
    }
  }

  private openBreaker(reason: string): void {
    this.state = 'open';
    this.metrics.state = 'open';
    this.metrics.openedAt = new Date();
    this.emit('StateChanged', { state: 'open', reason });

    if (this.halfOpenTimer) clearTimeout(this.halfOpenTimer);
    
    this.halfOpenTimer = setTimeout(() => {
      this.state = 'half_open';
      this.metrics.state = 'half_open';
      this.recentResults = []; // clear window
      this.emit('StateChanged', { state: 'half_open', reason: 'Auto-retry after 60s' });
    }, 60000);
  }

  /**
   * Returns true if breaker is open
   */
  public isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Gets current state
   */
  public getState(): GlobalBreakerState {
    return this.state;
  }

  /**
   * Gets metrics
   */
  public getMetrics(): BreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Manually opens breaker
   */
  public forceOpen(reason: string): void {
    this.openBreaker(reason);
  }

  /**
   * Manually resets breaker
   */
  public forceClose(): void {
    this.state = 'closed';
    this.metrics.state = 'closed';
    this.recentResults = [];
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }
    this.emit('StateChanged', { state: 'closed', reason: 'Manual force close' });
  }

  /**
   * Throws if open
   */
  public checkAndThrow(): void {
    if (this.isOpen()) {
      throw new Error('GlobalCircuitBreaker is OPEN. Operations suspended.');
    }
  }
}

export const globalCircuitBreaker = new GlobalCircuitBreaker();
