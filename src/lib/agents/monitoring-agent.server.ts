import { routedCall } from '@/lib/model-router.server';

export interface MetricsAnalysis {
  summary: string;
  trends: string[];
  concerns: string[];
}

export interface Anomaly {
  timestamp: string;
  value: number;
  expectedRange: [number, number];
  severity: 'low' | 'medium' | 'high';
}

export interface AlertRule {
  name: string;
  condition: string;
  threshold: string;
  action: string;
}

export interface DashboardConfig {
  panels: { title: string; query: string; type: string }[];
}

/**
 * MonitoringAgent provides capabilities for analyzing metrics, detecting anomalies, and configuring alerts.
 */
export class MonitoringAgent {
  private systemPrompt = `You are an expert SRE and monitoring engineer. Your goal is to analyze system metrics, detect anomalies, and ensure system observability. Always return structured JSON when data is requested.`;

  /**
   * Analyzes a set of system metrics.
   * @param metrics The metrics data object.
   * @returns A metrics analysis.
   */
  async analyzeMetrics(metrics: object): Promise<MetricsAnalysis> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Analyze these metrics: ${JSON.stringify(metrics)}. Return a JSON object with 'summary' (string), 'trends' (array of strings), and 'concerns' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as MetricsAnalysis;
    } catch (error) {
      throw new Error(`Failed to analyze metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detects anomalies in a time series dataset.
   * @param timeSeries Array of numerical values representing a time series.
   * @returns An array of detected anomalies.
   */
  async detectAnomalies(timeSeries: number[]): Promise<Anomaly[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Detect anomalies in this time series data: ${JSON.stringify(timeSeries)}. Return a JSON array of objects with 'timestamp' (string ISO), 'value' (number), 'expectedRange' (array of two numbers), and 'severity' (low/medium/high).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as Anomaly[];
    } catch (error) {
      throw new Error(`Failed to detect anomalies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates alert rules based on Service Level Objectives (SLOs).
   * @param slo The SLO configuration.
   * @returns An array of alert rules.
   */
  async generateAlertRules(slo: object): Promise<AlertRule[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate alert rules for these SLOs: ${JSON.stringify(slo)}. Return a JSON array of objects with 'name', 'condition', 'threshold', and 'action'.`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as AlertRule[];
    } catch (error) {
      throw new Error(`Failed to generate alert rules: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a dashboard configuration for given metrics.
   * @param metrics List of metric names to monitor.
   * @returns A dashboard configuration.
   */
  async createDashboard(metrics: string[]): Promise<DashboardConfig> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Create a dashboard config for these metrics: ${JSON.stringify(metrics)}. Return a JSON object with 'panels' (array of objects with 'title', 'query', 'type').`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as DashboardConfig;
    } catch (error) {
      throw new Error(`Failed to create dashboard: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
