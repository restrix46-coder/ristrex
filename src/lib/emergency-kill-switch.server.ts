import { getSql } from '@/lib/db';
import { EventEmitter } from 'events';

export interface KillSwitchState {
  active: boolean;
  reason?: string;
  activatedBy: string;
  activatedAt?: Date;
  deactivatedAt?: Date;
}

export class KillSwitchActiveError extends Error {
  public statusCode = 503;
  constructor(reason?: string) {
    super(`KillSwitch is ACTIVE. Autonomous execution is suspended. Reason: ${reason || 'Unknown'}`);
    this.name = 'KillSwitchActiveError';
  }
}

/**
 * Emergency Kill Switch — immediately stops all Autonomous Execution.
 */
export class EmergencyKillSwitch {
  private state: KillSwitchState = { active: false, activatedBy: 'system' };
  private hooks: Array<() => Promise<void>> = [];
  private eventBus = new EventEmitter();

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const sql = await getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS kill_switch_state (
          id SERIAL PRIMARY KEY,
          active BOOLEAN NOT NULL,
          reason TEXT,
          activated_by TEXT NOT NULL,
          activated_at TIMESTAMP WITH TIME ZONE,
          deactivated_at TIMESTAMP WITH TIME ZONE
        );
      `;
      
      const rows = await sql`
        SELECT active, reason, activated_by, activated_at, deactivated_at 
        FROM kill_switch_state 
        ORDER BY id DESC LIMIT 1
      `;
      if (rows.length > 0) {
        this.state = {
          active: rows[0].active,
          reason: rows[0].reason,
          activatedBy: rows[0].activated_by,
          activatedAt: rows[0].activated_at,
          deactivatedAt: rows[0].deactivated_at,
        };
      }
    } catch (e) {
      console.error('Failed to init EmergencyKillSwitch', e);
    }
  }

  /**
   * Activates the kill switch
   * @param reason The reason for activation
   * @param activatedBy The user or system activating it
   */
  public async activate(reason: string, activatedBy: string): Promise<void> {
    if (this.state.active) return;

    this.state = {
      active: true,
      reason,
      activatedBy,
      activatedAt: new Date(),
    };

    const sql = await getSql();
    await sql`
      INSERT INTO kill_switch_state (active, reason, activated_by, activated_at)
      VALUES (true, ${reason}, ${activatedBy}, ${this.state.activatedAt})
    `;

    this.eventBus.emit('KillSwitchActivated', this.state);

    for (const hook of this.hooks) {
      try {
        await hook();
      } catch (e) {
        console.error('Error executing kill switch hook', e);
      }
    }
  }

  /**
   * Deactivates the kill switch
   * @param deactivatedBy The user deactivating it
   */
  public async deactivate(deactivatedBy: string): Promise<void> {
    if (!this.state.active) return;

    this.state.active = false;
    this.state.deactivatedAt = new Date();

    const sql = await getSql();
    await sql`
      INSERT INTO kill_switch_state (active, reason, activated_by, deactivated_at)
      VALUES (false, 'Deactivated', ${deactivatedBy}, ${this.state.deactivatedAt})
    `;

    this.eventBus.emit('KillSwitchDeactivated', this.state);
  }

  /**
   * Checks if active
   */
  public isActive(): boolean {
    return this.state.active;
  }

  /**
   * Gets current state
   */
  public getState(): KillSwitchState {
    return { ...this.state };
  }

  /**
   * Throws if kill switch is active
   */
  public checkAndThrow(): void {
    if (this.state.active) {
      throw new KillSwitchActiveError(this.state.reason);
    }
  }

  /**
   * Add a hook to execute on activation
   * @param hook Function to run
   */
  public addHook(hook: () => Promise<void>): void {
    this.hooks.push(hook);
  }

  public on(event: string, listener: (...args: any[]) => void) {
    this.eventBus.on(event, listener);
  }
}

export const killSwitch = new EmergencyKillSwitch();
