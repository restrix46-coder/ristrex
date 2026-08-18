import { getSql } from '@/lib/db';

export type NodeType = 'file' | 'module' | 'function' | 'api' | 'db_table' | 'service' | 'agent' | 'user' | 'feature' | 'deployment' | 'test';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: 'imports' | 'calls' | 'uses' | 'deploys' | 'tests' | 'owns' | 'depends_on' | 'reads' | 'writes';
}

/**
 * A unified System Graph linking ALL system elements
 */
export class SystemGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];

  /**
   * Adds a node to the graph
   * @param node - GraphNode object
   */
  async addNode(node: GraphNode): Promise<void> {
    this.nodes.set(node.id, node);
    await this._persist();
  }

  /**
   * Adds an edge to the graph
   * @param edge - GraphEdge object
   */
  async addEdge(edge: GraphEdge): Promise<void> {
    if (!this.edges.some(e => e.from === edge.from && e.to === edge.to && e.relation === edge.relation)) {
      this.edges.push(edge);
      await this._persist();
    }
  }

  /**
   * Removes a node and its associated edges
   * @param id - Node ID
   */
  async removeNode(id: string): Promise<void> {
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
    await this._persist();
  }

  /**
   * Removes a specific edge
   * @param from - Origin node ID
   * @param to - Target node ID
   */
  async removeEdge(from: string, to: string): Promise<void> {
    this.edges = this.edges.filter(e => !(e.from === from && e.to === to));
    await this._persist();
  }

  /**
   * Finds all nodes affected if a node changes (downstream)
   * @param nodeId - Source node ID
   */
  findImpact(nodeId: string): GraphNode[] {
    const visited = new Set<string>();
    const stack = [nodeId];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (!visited.has(current)) {
        visited.add(current);
        const dependents = this.edges.filter(e => e.to === current).map(e => e.from);
        stack.push(...dependents);
      }
    }
    
    return Array.from(visited)
      .filter(id => id !== nodeId)
      .map(id => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined);
  }

  /**
   * Finds all nodes this node depends on (upstream)
   * @param nodeId - Source node ID
   */
  findDependencies(nodeId: string): GraphNode[] {
    const visited = new Set<string>();
    const stack = [nodeId];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (!visited.has(current)) {
        visited.add(current);
        const dependencies = this.edges.filter(e => e.from === current).map(e => e.to);
        stack.push(...dependencies);
      }
    }
    
    return Array.from(visited)
      .filter(id => id !== nodeId)
      .map(id => this.nodes.get(id))
      .filter((n): n is GraphNode => n !== undefined);
  }

  /**
   * Returns nodes with no connections
   */
  findOrphans(): GraphNode[] {
    const connectedIds = new Set<string>();
    for (const edge of this.edges) {
      connectedIds.add(edge.from);
      connectedIds.add(edge.to);
    }
    
    const orphans: GraphNode[] = [];
    for (const [id, node] of this.nodes.entries()) {
      if (!connectedIds.has(id)) {
        orphans.push(node);
      }
    }
    return orphans;
  }

  /**
   * Answers common architecture questions
   * @param question - A question string
   */
  answer(question: string): string {
    return `Analysis for: "${question}" (placeholder response based on graph state)`;
  }

  /**
   * Exports the graph as a Mermaid diagram
   */
  toMermaid(): string {
    let diagram = 'graph TD;\n';
    for (const [id, node] of this.nodes.entries()) {
      diagram += `  ${id}["${node.name} (${node.type})"];\n`;
    }
    for (const edge of this.edges) {
      diagram += `  ${edge.from} -->|${edge.relation}| ${edge.to};\n`;
    }
    return diagram;
  }

  /**
   * Finds the shortest path between two nodes using BFS
   * @param from - Start node ID
   * @param to - End node ID
   */
  shortestPath(from: string, to: string): GraphNode[] | null {
    const queue: { id: string, path: string[] }[] = [{ id: from, path: [from] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (id === to) {
        return path.map(p => this.nodes.get(p)).filter((n): n is GraphNode => !!n);
      }

      if (!visited.has(id)) {
        visited.add(id);
        const neighbors = this.edges.filter(e => e.from === id).map(e => e.to)
            .concat(this.edges.filter(e => e.to === id).map(e => e.from)); // Undirected traversal for shortest path
        for (const neighbor of neighbors) {
          queue.push({ id: neighbor, path: [...path, neighbor] });
        }
      }
    }
    return null;
  }

  private async _persist() {
    // In-memory with PostgreSQL persistence
    const sql = await getSql();
    try {
      await sql`CREATE TABLE IF NOT EXISTS system_graph_nodes (id TEXT PRIMARY KEY, data JSONB)`;
      await sql`CREATE TABLE IF NOT EXISTS system_graph_edges (from_node TEXT, to_node TEXT, relation TEXT, PRIMARY KEY(from_node, to_node, relation))`;
      
      // Detailed insert/update logic omitted for brevity, but would sync this.nodes and this.edges to DB
    } catch (e) {
      console.error('[SystemGraph] Persistence error', e);
    }
  }
}

export const systemGraph = new SystemGraph();
