import { logger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a node in the dependency graph.
 */
export interface DependencyNode {
  id: string;
  type: 'file' | 'component' | 'function' | 'api' | 'service' | 'database' | 'test';
  name: string;
  filePath?: string;
  exports: string[];
  imports: string[];
}

/**
 * Represents an edge in the dependency graph.
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'extends' | 'uses' | 'tests';
}

/**
 * Represents a complete dependency graph.
 */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  entryPoints: string[];
  cycles: string[][];
}

/**
 * Builder for analyzing project dependency graphs.
 */
export class DependencyGraphBuilder {
  /**
   * Builds a full dependency graph for a given project path.
   * @param projectPath The root directory of the project.
   * @returns The constructed DependencyGraph.
   */
  buildGraph(projectPath: string): DependencyGraph {
    logger.info(`Building dependency graph for ${projectPath}`);
    // Basic stub implementation for building the graph
    const graph: DependencyGraph = {
      nodes: [],
      edges: [],
      entryPoints: [],
      cycles: []
    };
    
    // Real implementation would recursively read files and use regex or AST.
    return graph;
  }

  /**
   * Finds circular dependencies in the graph.
   * @param graph The dependency graph.
   * @returns Array of cycles (each cycle is an array of node IDs).
   */
  findCycles(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const pathList: string[] = [];

    const nodesMap = new Map(graph.nodes.map(n => [n.id, n]));
    const adjList = new Map<string, string[]>();

    for (const edge of graph.edges) {
      if (!adjList.has(edge.from)) adjList.set(edge.from, []);
      adjList.get(edge.from)!.push(edge.to);
    }

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      pathList.push(nodeId);

      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          // Cycle detected
          const cycleStart = pathList.indexOf(neighbor);
          cycles.push(pathList.slice(cycleStart));
        }
      }

      recStack.delete(nodeId);
      pathList.pop();
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /**
   * Finds unused nodes (dead code) in the graph.
   * @param graph The dependency graph.
   * @returns Array of DependencyNode that are not imported or used.
   */
  findUnused(graph: DependencyGraph): DependencyNode[] {
    const usedNodes = new Set<string>(graph.entryPoints);
    for (const edge of graph.edges) {
      usedNodes.add(edge.to); // If something points to it, it's used
    }
    
    return graph.nodes.filter(node => !usedNodes.has(node.id));
  }

  /**
   * Gets the impact of changing a specific file.
   * @param filePath The file path to check.
   * @param graph The dependency graph.
   * @returns Array of DependencyNode that depend on this file.
   */
  getImpactOf(filePath: string, graph: DependencyGraph): DependencyNode[] {
    const node = graph.nodes.find(n => n.filePath === filePath);
    if (!node) return [];

    const impacted = new Set<string>();
    const queue = [node.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of graph.edges) {
        if (edge.to === current && !impacted.has(edge.from)) {
          impacted.add(edge.from);
          queue.push(edge.from);
        }
      }
    }

    return graph.nodes.filter(n => impacted.has(n.id));
  }

  /**
   * Converts the graph to a Mermaid diagram string.
   * @param graph The dependency graph.
   * @returns Mermaid flowchart diagram.
   */
  toMermaid(graph: DependencyGraph): string {
    let mermaid = 'graph TD;\n';
    for (const edge of graph.edges) {
      let edgeStyle = '-->';
      if (edge.type === 'calls') edgeStyle = '-.->';
      mermaid += `  ${edge.from} ${edgeStyle} ${edge.to};\n`;
    }
    return mermaid;
  }

  /**
   * Converts the graph to a JSON serializable format.
   * @param graph The dependency graph.
   * @returns JSON string of the graph.
   */
  toJson(graph: DependencyGraph): string {
    return JSON.stringify(graph, null, 2);
  }
}
