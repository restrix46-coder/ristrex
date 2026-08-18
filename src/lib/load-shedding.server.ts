export type RequestPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

export interface LoadSheddingConfig {
  highLoadThreshold: number;
  criticalLoadThreshold: number;
  checkIntervalMs: number;
}

export interface LoadState {
  currentLoad: number;
  status: 'normal' | 'high' | 'critical';
  droppedRequests: number;
  acceptedRequests: number;
}

/**
 * Load Shedding Service intelligently drops low-priority work under extreme load.
 * خدمة التخلص من الحمل تسقط العمل ذي الأولوية المنخفضة بذكاء تحت الحمل الشديد.
 */
export class LoadSheddingService {
  private config: LoadSheddingConfig;
  private state: LoadState;
  private customLoadSource?: () => number;

  constructor(config: LoadSheddingConfig) {
    this.config = config;
    this.state = {
      currentLoad: 0,
      status: 'normal',
      droppedRequests: 0,
      acceptedRequests: 0
    };
    
    // Simulate updating load periodically
    setInterval(() => this.updateLoad(), this.config.checkIntervalMs);
  }

  /**
   * Sets custom load measurement function.
   */
  setLoadSource(fn: () => number): void {
    this.customLoadSource = fn;
  }

  /**
   * Updates the current load state.
   */
  private updateLoad() {
    if (this.customLoadSource) {
      this.state.currentLoad = this.customLoadSource();
    }
    if (this.state.currentLoad >= this.config.criticalLoadThreshold) {
      this.state.status = 'critical';
    } else if (this.state.currentLoad >= this.config.highLoadThreshold) {
      this.state.status = 'high';
    } else {
      this.state.status = 'normal';
    }
  }

  /**
   * Returns true if request should be accepted based on priority and load.
   */
  shouldAccept(priority: RequestPriority): boolean {
    // normal load: accept ALL
    if (this.state.status === 'normal') {
      return true;
    }
    
    // high load (>70%): drop background, throttle low
    if (this.state.status === 'high') {
      if (priority === 'background') return false;
      if (priority === 'low') return Math.random() > 0.5; // Throttle low
      return true;
    }
    
    // critical load (>90%): drop low+background, throttle normal, pass high+critical only
    if (this.state.status === 'critical') {
      if (priority === 'background' || priority === 'low') return false;
      if (priority === 'normal') return Math.random() > 0.8; // Throttle normal heavily
      return true;
    }

    return true;
  }

  /**
   * Records a request's acceptance or rejection for stats.
   */
  recordRequest(priority: RequestPriority, accepted: boolean): void {
    if (accepted) {
      this.state.acceptedRequests++;
    } else {
      this.state.droppedRequests++;
    }
  }

  /**
   * Returns current load percentage.
   */
  getCurrentLoad(): number {
    return this.state.currentLoad;
  }

  /**
   * Returns full LoadState.
   */
  getState(): LoadState {
    return { ...this.state };
  }
}

export const loadShedding = new LoadSheddingService({
  highLoadThreshold: 70,
  criticalLoadThreshold: 90,
  checkIntervalMs: 5000
});
