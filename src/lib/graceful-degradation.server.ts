export type ServiceTier = 'critical' | 'important' | 'optional';

export interface ServiceRegistration {
  id: string;
  name: string;
  tier: ServiceTier;
  healthCheck: () => Promise<boolean>;
  fallback?: () => Promise<unknown>;
  lastStatus: 'healthy' | 'degraded' | 'down';
  degradedAt?: Date;
}

export interface DegradationState {
  degradedServices: string[];
  criticalDown: boolean;
  importantDown: string[];
  optionalDown: string[];
  overallHealth: 'healthy' | 'degraded' | 'critical';
}

/**
 * Graceful Degradation — system stays functional when non-critical services fail.
 */
export class GracefulDegradationService {
  private services = new Map<string, ServiceRegistration>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // Database (Critical)
    this.register({
      id: 'db', name: 'Database', tier: 'critical',
      healthCheck: async () => true, // Replace with actual check
    });
    // AI Models (Important)
    this.register({
      id: 'ai_models', name: 'AI Models', tier: 'important',
      healthCheck: async () => true,
    });
    // Email (Optional)
    this.register({
      id: 'email', name: 'Email', tier: 'optional',
      healthCheck: async () => true,
    });
    // Storage, Queue, Search
    this.register({ id: 'storage', name: 'Storage', tier: 'critical', healthCheck: async () => true });
    this.register({ id: 'queue', name: 'Message Queue', tier: 'important', healthCheck: async () => true });
    this.register({ id: 'search', name: 'Search', tier: 'optional', healthCheck: async () => true });
  }

  public register(service: Omit<ServiceRegistration, 'lastStatus'>): void {
    this.services.set(service.id, { ...service, lastStatus: 'healthy' });
  }

  public async checkHealth(): Promise<void> {
    for (const [id, service] of this.services) {
      try {
        const isHealthy = await service.healthCheck();
        service.lastStatus = isHealthy ? 'healthy' : 'down';
        if (!isHealthy && !service.degradedAt) service.degradedAt = new Date();
        if (isHealthy) service.degradedAt = undefined;
      } catch (e) {
        service.lastStatus = 'down';
        if (!service.degradedAt) service.degradedAt = new Date();
      }
    }
  }

  public getState(): DegradationState {
    const state: DegradationState = {
      degradedServices: [],
      criticalDown: false,
      importantDown: [],
      optionalDown: [],
      overallHealth: 'healthy'
    };

    for (const [id, service] of this.services) {
      if (service.lastStatus !== 'healthy') {
        state.degradedServices.push(id);
        if (service.tier === 'critical') state.criticalDown = true;
        if (service.tier === 'important') state.importantDown.push(id);
        if (service.tier === 'optional') state.optionalDown.push(id);
      }
    }

    if (state.criticalDown) state.overallHealth = 'critical';
    else if (state.degradedServices.length > 0) state.overallHealth = 'degraded';

    return state;
  }

  public async executeWithFallback<T>(serviceId: string, operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const service = this.services.get(serviceId);
    
    if (service && service.lastStatus === 'down') {
      if (fallback) return await fallback();
      if (service.fallback) return await service.fallback() as T;
      throw new Error(`Service ${serviceId} is down and no fallback provided.`);
    }

    try {
      return await operation();
    } catch (e) {
      if (fallback) return await fallback();
      if (service && service.fallback) return await service.fallback() as T;
      throw e;
    }
  }

  public isAvailable(serviceId: string): boolean {
    const service = this.services.get(serviceId);
    return service ? service.lastStatus === 'healthy' : false;
  }

  public generateDegradationReport(): string {
    const state = this.getState();
    return `# Degradation Report
Overall Health: ${state.overallHealth}
Critical Down: ${state.criticalDown}
Important Down: ${state.importantDown.join(', ')}
Optional Down: ${state.optionalDown.join(', ')}
    `;
  }
}

export const gracefulDegradation = new GracefulDegradationService();
