import { getSql } from '@/lib/db';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export const DIGITAL_TWIN_MIGRATION = `
CREATE TABLE IF NOT EXISTS digital_twins (
  project_id TEXT PRIMARY KEY,
  snapshot JSONB NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1
);
`;

export interface DigitalTwinState {
  projectId: string;
  snapshot: {
    users: any[];
    features: any[];
    modules: any[];
    components: any[];
    apis: any[];
    database: any[];
    services: any[];
    queues: any[];
    infrastructure: any[];
    dependencies: any[];
    tests: any[];
    deployments: any[];
    monitoring: any[];
  };
  lastUpdated: Date;
  version: number;
}

/**
 * A live Digital Twin of every project
 */
export class DigitalTwin extends EventEmitter {
  /**
   * Returns current snapshot for a project
   * @param projectId - Project identifier
   */
  async getState(projectId: string): Promise<DigitalTwinState | null> {
    const sql = await getSql();
    const rows = await sql`SELECT * FROM digital_twins WHERE project_id = ${projectId}`;
    if (rows.length === 0) return null;
    return {
      projectId: rows[0].project_id,
      snapshot: rows[0].snapshot,
      lastUpdated: rows[0].last_updated,
      version: rows[0].version
    };
  }

  /**
   * Updates feature state
   * @param projectId - Project identifier
   * @param featureId - Feature identifier
   * @param data - Feature data
   */
  async updateFeature(projectId: string, featureId: string, data: any): Promise<void> {
    await this._updateField(projectId, 'features', featureId, data);
  }

  /**
   * Updates module state
   * @param projectId - Project identifier
   * @param moduleId - Module identifier
   * @param data - Module data
   */
  async updateModule(projectId: string, moduleId: string, data: any): Promise<void> {
    await this._updateField(projectId, 'modules', moduleId, data);
  }

  /**
   * Adds a deployment record
   * @param projectId - Project identifier
   * @param deployment - Deployment data
   */
  async recordDeployment(projectId: string, deployment: any): Promise<void> {
    await this._appendToArray(projectId, 'deployments', deployment);
  }

  /**
   * Returns what changed since a specific version
   * @param projectId - Project identifier
   * @param sinceVersion - Version number
   */
  async getDiff(projectId: string, sinceVersion: number): Promise<any> {
    const state = await this.getState(projectId);
    if (!state) return null;
    return {
      projectId,
      diff: `Diff from version ${sinceVersion} to ${state.version}`, // Placeholder for actual diff logic
      currentVersion: state.version
    };
  }

  /**
   * Subscribes to real-time updates
   * @param projectId - Project identifier
   * @param callback - Function to call on update
   */
  subscribe(projectId: string, callback: (state: DigitalTwinState) => void): void {
    this.on(`update:${projectId}`, callback);
  }

  /**
   * Watches filesystem and auto-updates state
   * @param projectId - Project identifier
   * @param filesystemPath - Path to watch
   */
  async autoSync(projectId: string, filesystemPath: string): Promise<void> {
    try {
      const watcher = fs.watch(filesystemPath, { recursive: true });
      for await (const event of watcher) {
        if (event.eventType === 'change') {
           console.log(`[DigitalTwin] Change detected in ${filesystemPath}: ${event.filename}`);
           // Logic to sync specific file changes into Digital Twin state
           this.emit(`sync:${projectId}`, event.filename);
        }
      }
    } catch (error) {
      console.error(`[DigitalTwin] autoSync failed for ${projectId}:`, error);
    }
  }

  private async _updateField(projectId: string, field: keyof DigitalTwinState['snapshot'], itemId: string, data: any) {
    const state = await this.getState(projectId);
    if (!state) return;
    
    const items = state.snapshot[field] || [];
    const index = items.findIndex((i: any) => i.id === itemId);
    if (index >= 0) {
      items[index] = { ...items[index], ...data };
    } else {
      items.push({ id: itemId, ...data });
    }
    
    state.snapshot[field] = items;
    await this._saveState(projectId, state.snapshot);
  }

  private async _appendToArray(projectId: string, field: keyof DigitalTwinState['snapshot'], data: any) {
    const state = await this.getState(projectId);
    if (!state) return;
    
    const items = state.snapshot[field] || [];
    items.push(data);
    state.snapshot[field] = items;
    await this._saveState(projectId, state.snapshot);
  }

  private async _saveState(projectId: string, snapshot: any) {
    const sql = await getSql();
    const rows = await sql`
      INSERT INTO digital_twins (project_id, snapshot, version)
      VALUES (${projectId}, ${snapshot}, 1)
      ON CONFLICT (project_id) DO UPDATE SET
        snapshot = EXCLUDED.snapshot,
        last_updated = CURRENT_TIMESTAMP,
        version = digital_twins.version + 1
      RETURNING *;
    `;
    const newState: DigitalTwinState = {
      projectId: rows[0].project_id,
      snapshot: rows[0].snapshot,
      lastUpdated: rows[0].last_updated,
      version: rows[0].version
    };
    this.emit(`update:${projectId}`, newState);
  }
}

export const digitalTwin = new DigitalTwin();
