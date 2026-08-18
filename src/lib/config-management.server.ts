import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface ConfigEntry {
  key: string;
  value: unknown;
  environment: 'development' | 'staging' | 'production' | 'all';
  source: 'env' | 'vault' | 'database' | 'file';
  sensitive: boolean;
  lastModified: Date;
}

export interface ConfigDrift {
  key: string;
  expected: unknown;
  actual: unknown;
  environment: string;
  severity: 'critical' | 'high' | 'medium';
}

/**
 * Manages configuration across environments and detects configuration drift.
 */
export class ConfigManager {
  /**
   * Retrieves a configuration value for a given environment.
   * @param key The configuration key.
   * @param environment The environment to fetch for.
   * @returns The configuration value.
   */
  public async get(key: string, environment: string = 'development'): Promise<unknown | null> {
    try {
      const sql = await getSql();
      const result = await sql`
        SELECT value FROM config_entries
        WHERE key = ${key} AND (environment = ${environment} OR environment = 'all')
        ORDER BY environment DESC
        LIMIT 1
      `;
      return result.length > 0 ? result[0].value : null;
    } catch (error) {
      logger.error(`Error retrieving config for key ${key}:`, error);
      throw new Error(`Config retrieval failed for ${key}`);
    }
  }

  /**
   * Sets a configuration value for a specific environment.
   * @param key The configuration key.
   * @param value The value to set.
   * @param environment The target environment.
   */
  public async set(key: string, value: unknown, environment: string): Promise<void> {
    try {
      const sql = await getSql();
      await sql`
        INSERT INTO config_entries (key, value, environment, source, sensitive, last_modified)
        VALUES (${key}, ${value}, ${environment}, 'database', false, NOW())
        ON CONFLICT (key, environment) DO UPDATE SET
          value = EXCLUDED.value,
          last_modified = NOW()
      `;
      logger.info(`Successfully set config for key ${key} in ${environment}`);
    } catch (error) {
      logger.error(`Error setting config for key ${key}:`, error);
      throw new Error(`Config update failed for ${key}`);
    }
  }

  /**
   * Detects drift between a baseline configuration and an actual configuration.
   * @param baseline The baseline configuration record.
   * @param actual The actual configuration record.
   * @returns An array of detected configuration drifts.
   */
  public detectDrift(baseline: Record<string, unknown>, actual: Record<string, unknown>): ConfigDrift[] {
    const drifts: ConfigDrift[] = [];
    try {
      for (const [key, expectedValue] of Object.entries(baseline)) {
        const actualValue = actual[key];
        if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
          drifts.push({
            key,
            expected: expectedValue,
            actual: actualValue,
            environment: 'unknown',
            severity: this.calculateSeverity(key)
          });
        }
      }
      return drifts;
    } catch (error) {
      logger.error('Error detecting configuration drift', error);
      throw new Error('Config drift detection failed');
    }
  }

  /**
   * Compares the configuration of two environments.
   * @param env1 The first environment name.
   * @param env2 The second environment name.
   * @returns An array of drifts between the two environments.
   */
  public async compareEnvironments(env1: string, env2: string): Promise<ConfigDrift[]> {
    try {
      const sql = await getSql();
      const env1Configs = await sql`SELECT key, value FROM config_entries WHERE environment = ${env1}`;
      const env2Configs = await sql`SELECT key, value FROM config_entries WHERE environment = ${env2}`;

      const baseline = Object.fromEntries(env1Configs.map(c => [c.key, c.value]));
      const actual = Object.fromEntries(env2Configs.map(c => [c.key, c.value]));

      const drifts = this.detectDrift(baseline, actual);
      return drifts.map(d => ({ ...d, environment: `${env1} vs ${env2}` }));
    } catch (error) {
      logger.error(`Error comparing environments ${env1} and ${env2}:`, error);
      throw new Error('Environment comparison failed');
    }
  }

  /**
   * Validates a configuration object against a JSON schema-like object.
   * @param config The configuration object to validate.
   * @param schema The schema to validate against.
   * @returns True if valid, false otherwise.
   */
  public validateConfig(config: Record<string, unknown>, schema: Record<string, any>): boolean {
    try {
      for (const [key, rules] of Object.entries(schema)) {
        if (rules.required && !(key in config)) {
          return false;
        }
        if (key in config && typeof config[key] !== rules.type) {
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error('Error validating config:', error);
      return false;
    }
  }

  /**
   * Generates a markdown report for configuration drifts.
   * @param drifts The drifts to report on.
   * @returns A markdown string report.
   */
  public generateDriftReport(drifts: ConfigDrift[]): string {
    if (drifts.length === 0) return '# Configuration Drift Report\n\nNo drift detected. Environments are aligned.';
    let report = '# Configuration Drift Report\n\n| Key | Environment | Expected | Actual | Severity |\n|---|---|---|---|---|\n';
    for (const d of drifts) {
      report += `| ${d.key} | ${d.environment} | \`${JSON.stringify(d.expected)}\` | \`${JSON.stringify(d.actual)}\` | **${d.severity}** |\n`;
    }
    return report;
  }

  /**
   * Synchronizes configuration from a source environment to a target environment.
   * @param source The source environment name.
   * @param target The target environment name.
   */
  public async syncToTarget(source: string, target: string): Promise<void> {
    try {
      const sql = await getSql();
      const sourceConfigs = await sql`SELECT key, value, sensitive FROM config_entries WHERE environment = ${source}`;
      
      for (const config of sourceConfigs) {
        if (!config.sensitive) {
          await this.set(config.key, config.value, target);
        } else {
          logger.warn(`Skipping sensitive config key ${config.key} during sync from ${source} to ${target}`);
        }
      }
      logger.info(`Successfully synced non-sensitive configs from ${source} to ${target}`);
    } catch (error) {
      logger.error(`Error syncing from ${source} to ${target}:`, error);
      throw new Error(`Sync failed from ${source} to ${target}`);
    }
  }

  private calculateSeverity(key: string): 'critical' | 'high' | 'medium' {
    if (key.includes('db') || key.includes('secret') || key.includes('url')) return 'critical';
    if (key.includes('feature') || key.includes('flag')) return 'high';
    return 'medium';
  }
}

export const configManager = new ConfigManager();
