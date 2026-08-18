export interface CpmTask {
  id: string;
  name: string;
  duration: number;
  dependencies: string[];
  earliestStart?: number;
  earliestFinish?: number;
  latestStart?: number;
  latestFinish?: number;
  slack?: number;
  isCritical?: boolean;
  assignedAgent?: string;
}

export interface CriticalPathResult {
  criticalPath: string[];
  totalDuration: number;
  tasks: CpmTask[];
  parallelGroups: string[][];
  bottlenecks: CpmTask[];
  estimatedCompletionDate: Date;
}

export class CriticalPathCalculator {
  /**
   * Calculates the critical path and updates task timing details.
   */
  public calculate(tasks: CpmTask[]): CriticalPathResult {
    const taskMap = new Map<string, CpmTask>(tasks.map(t => [t.id, { ...t }]));
    
    // Forward Pass
    let changed = true;
    while (changed) {
      changed = false;
      for (const task of taskMap.values()) {
        const es = task.dependencies.reduce((max, depId) => {
          const dep = taskMap.get(depId);
          return Math.max(max, dep?.earliestFinish || 0);
        }, 0);
        
        if (task.earliestStart !== es) {
          task.earliestStart = es;
          task.earliestFinish = es + task.duration;
          changed = true;
        }
      }
    }

    const totalDuration = Array.from(taskMap.values()).reduce((max, t) => Math.max(max, t.earliestFinish || 0), 0);

    // Backward Pass
    changed = true;
    // Initialize latestFinish for tasks without dependents
    for (const task of taskMap.values()) {
      task.latestFinish = totalDuration;
      task.latestStart = totalDuration - task.duration;
    }

    while (changed) {
      changed = false;
      for (const task of taskMap.values()) {
        // Find all tasks that depend on this task
        const dependents = Array.from(taskMap.values()).filter(t => t.dependencies.includes(task.id));
        if (dependents.length > 0) {
          const lf = dependents.reduce((min, dep) => Math.min(min, dep.latestStart || totalDuration), totalDuration);
          if (task.latestFinish !== lf) {
            task.latestFinish = lf;
            task.latestStart = lf - task.duration;
            changed = true;
          }
        }
      }
    }

    // Calculate Slack and Critical Path
    const criticalPath: string[] = [];
    const bottlenecks: CpmTask[] = [];

    for (const task of taskMap.values()) {
      task.slack = (task.latestStart || 0) - (task.earliestStart || 0);
      task.isCritical = task.slack === 0;
      if (task.isCritical) {
        criticalPath.push(task.id);
        if (task.dependencies.length > 1) {
          bottlenecks.push(task);
        }
      }
    }

    const updatedTasks = Array.from(taskMap.values());
    
    return {
      criticalPath,
      totalDuration,
      tasks: updatedTasks,
      parallelGroups: this.findParallelOpportunities(updatedTasks),
      bottlenecks,
      estimatedCompletionDate: new Date(Date.now() + totalDuration * 86400000) // Rough estimation assuming duration is days
    };
  }

  /**
   * Returns an array of task IDs that make up the critical path.
   */
  public findCriticalPath(tasks: CpmTask[]): string[] {
    const result = this.calculate(tasks);
    return result.criticalPath;
  }

  /**
   * Groups tasks that can be executed concurrently.
   */
  public findParallelOpportunities(tasks: CpmTask[]): string[][] {
    const groups: Record<number, string[]> = {};
    for (const task of tasks) {
      const time = task.earliestStart || 0;
      if (!groups[time]) groups[time] = [];
      groups[time].push(task.id);
    }
    return Object.values(groups).filter(group => group.length > 1);
  }

  /**
   * Identifies tasks that block many other tasks and are on the critical path.
   */
  public identifyBottlenecks(result: CriticalPathResult): CpmTask[] {
    return result.bottlenecks;
  }

  /**
   * Simple optimization assuming max parallel agents.
   */
  public optimizePlan(tasks: CpmTask[], maxParallelAgents: number): CpmTask[] {
    // Placeholder for actual resource-constrained scheduling logic
    return [...tasks].sort((a, b) => (a.slack || 0) - (b.slack || 0));
  }

  /**
   * Exports to Gantt data format.
   */
  public toGanttData(result: CriticalPathResult): any[] {
    return result.tasks.map(t => ({
      id: t.id,
      text: t.name,
      start_date: t.earliestStart,
      duration: t.duration,
      parent: t.dependencies.length > 0 ? t.dependencies[0] : null
    }));
  }

  /**
   * Generates a Mermaid Gantt diagram.
   */
  public toMermaid(result: CriticalPathResult): string {
    let mermaid = `gantt\n  title Project Schedule\n  dateFormat YYYY-MM-DD\n`;
    const startDate = new Date();
    
    result.tasks.forEach(t => {
      const taskStart = new Date(startDate.getTime() + (t.earliestStart || 0) * 86400000);
      mermaid += `  section ${t.name}\n`;
      mermaid += `  ${t.name} :${t.isCritical ? 'crit,' : ''}${t.id}, ${taskStart.toISOString().split('T')[0]}, ${t.duration}d\n`;
    });

    return mermaid;
  }
}

export const criticalPath = new CriticalPathCalculator();
