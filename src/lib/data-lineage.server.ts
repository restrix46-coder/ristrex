import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface DataAsset {
  id: string;
  name: string;
  type: 'table' | 'field' | 'api' | 'file' | 'stream' | 'model';
  service: string;
  schema?: object;
}

export interface LineageEdge {
  from: DataAsset;
  to: DataAsset;
  transformation?: string;
  timestamp: Date;
  tags: string[];
}

export interface LineageGraph {
  assets: DataAsset[];
  edges: LineageEdge[];
  roots: DataAsset[];
  leaves: DataAsset[];
}

/**
 * SQL Migration:
 * CREATE TABLE IF NOT EXISTS data_assets (
 *   id TEXT PRIMARY KEY,
 *   name TEXT,
 *   type TEXT,
 *   service TEXT,
 *   schema JSONB
 * );
 * CREATE TABLE IF NOT EXISTS lineage_edges (
 *   from_id TEXT,
 *   to_id TEXT,
 *   transformation TEXT,
 *   timestamp TIMESTAMP,
 *   tags JSONB,
 *   PRIMARY KEY (from_id, to_id)
 * );
 */

/**
 * Data Lineage Service tracks data source, transformations, and flow between services.
 * خدمة تدفق البيانات لتتبع مصدر البيانات وتحولاتها وتدفقها بين الخدمات.
 */
export class DataLineageService {
  
  /**
   * Records a data flow.
   */
  async recordTransformation(from: DataAsset, to: DataAsset, transformation?: string, tags: string[] = []): Promise<void> {
    const sql = await getSql();
    try {
      await sql.begin(async (tx) => {
        // Upsert from asset
        await tx`INSERT INTO data_assets (id, name, type, service, schema) VALUES (${from.id}, ${from.name}, ${from.type}, ${from.service}, ${from.schema ? JSON.stringify(from.schema) : null}) ON CONFLICT (id) DO NOTHING`;
        // Upsert to asset
        await tx`INSERT INTO data_assets (id, name, type, service, schema) VALUES (${to.id}, ${to.name}, ${to.type}, ${to.service}, ${to.schema ? JSON.stringify(to.schema) : null}) ON CONFLICT (id) DO NOTHING`;
        // Insert edge
        await tx`INSERT INTO lineage_edges (from_id, to_id, transformation, timestamp, tags) VALUES (${from.id}, ${to.id}, ${transformation || null}, ${new Date()}, ${JSON.stringify(tags)}) ON CONFLICT (from_id, to_id) DO UPDATE SET transformation = EXCLUDED.transformation, timestamp = EXCLUDED.timestamp`;
      });
    } catch (e) {
      logger.error('Failed to record transformation', e);
    }
  }

  /**
   * Returns full lineage graph for asset.
   */
  async getLineage(assetId: string): Promise<LineageGraph> {
    const upstream = await this.getUpstream(assetId);
    const downstream = await this.getDownstream(assetId);
    return {
      assets: [], // Would combine unique assets
      edges: [],  // Would combine edges
      roots: upstream,
      leaves: downstream
    };
  }

  /**
   * Where does this data come from?
   */
  async getUpstream(assetId: string): Promise<DataAsset[]> {
    const sql = await getSql();
    // Simplified: 1 level upstream
    const result = await sql`SELECT a.* FROM data_assets a JOIN lineage_edges e ON a.id = e.from_id WHERE e.to_id = ${assetId}`;
    return result as DataAsset[];
  }

  /**
   * Where does this data go?
   */
  async getDownstream(assetId: string): Promise<DataAsset[]> {
    const sql = await getSql();
    // Simplified: 1 level downstream
    const result = await sql`SELECT a.* FROM data_assets a JOIN lineage_edges e ON a.id = e.to_id WHERE e.from_id = ${assetId}`;
    return result as DataAsset[];
  }

  /**
   * What breaks if this changes?
   */
  async findImpact(assetId: string): Promise<DataAsset[]> {
    // Deep recursive downstream lookup would go here
    return this.getDownstream(assetId);
  }

  /**
   * Generates a Mermaid diagram for the graph.
   */
  generateLineageDiagram(graph: LineageGraph): string {
    let mermaid = 'graph TD;\n';
    for (const edge of graph.edges) {
      mermaid += `  ${edge.from.id}[${edge.from.name}] -->|${edge.transformation || ''}| ${edge.to.id}[${edge.to.name}];\n`;
    }
    return mermaid;
  }

  /**
   * Generates a markdown lineage report.
   */
  generateReport(assetId: string): string {
    return `# Data Lineage Report for ${assetId}\n\nReport content generated here.`;
  }
}

export const dataLineage = new DataLineageService();
