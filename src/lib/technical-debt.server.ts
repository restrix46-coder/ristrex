import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

export interface TechDebtItem {
  id: string;
  type: 'duplicate' | 'complexity' | 'dead_code' | 'outdated_dep' | 'missing_test' | 'poor_naming' | 'god_class' | 'long_function';
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  effort: 'hours' | 'days' | 'weeks';
  impact: string;
  suggestion: string;
}

/**
 * Service for analyzing and detecting technical debt in codebase.
 */
export class TechDebtAnalyzer {
  
  /**
   * Analyzes a single file for technical debt.
   * @param filePath - The path of the file
   * @param content - The string content of the file
   * @returns Array of technical debt items found
   */
  analyzeFile(filePath: string, content: string): TechDebtItem[] {
    const items: TechDebtItem[] = [];
    const lines = content.split('\n');
    
    // Check for God Class (File > 300 lines)
    if (lines.length > 300) {
      items.push({
        id: Math.random().toString(36).substring(7),
        type: 'god_class',
        file: filePath,
        severity: 'high',
        effort: 'days',
        impact: 'Hard to maintain and test, breaks Single Responsibility Principle.',
        suggestion: 'Split the file into smaller modules or classes based on functionality.'
      });
    }

    let functionLineCount = 0;
    let inFunction = false;

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for TODO/FIXME/HACK
      if (/(TODO|FIXME|HACK):/i.test(line)) {
        items.push({
          id: Math.random().toString(36).substring(7),
          type: 'poor_naming',
          file: filePath,
          line: lineNum,
          severity: 'low',
          effort: 'hours',
          impact: 'Unresolved technical tasks or temporary fixes left in codebase.',
          suggestion: 'Resolve the outstanding task or create a tracked issue for it.'
        });
      }

      // Check for console.log
      if (/console\.log\(/i.test(line)) {
        items.push({
          id: Math.random().toString(36).substring(7),
          type: 'dead_code',
          file: filePath,
          line: lineNum,
          severity: 'medium',
          effort: 'hours',
          impact: 'Potential data leak or unnecessary output in production.',
          suggestion: 'Use a proper logging library instead of console.log.'
        });
      }

      // Check for explicit 'any'
      if (/: any\b/.test(line)) {
        items.push({
          id: Math.random().toString(36).substring(7),
          type: 'complexity',
          file: filePath,
          line: lineNum,
          severity: 'medium',
          effort: 'hours',
          impact: 'Loss of type safety and editor autocomplete.',
          suggestion: 'Replace "any" with a specific type or "unknown".'
        });
      }

      // Very rudimentary function length check
      if (/function |=>/.test(line) || /\s\w+\(.*\)\s*\{/.test(line)) {
        inFunction = true;
        functionLineCount = 0;
      }
      
      if (inFunction) {
        functionLineCount++;
        if (line.includes('}')) {
          if (functionLineCount > 50) {
             items.push({
                id: Math.random().toString(36).substring(7),
                type: 'long_function',
                file: filePath,
                line: lineNum - functionLineCount,
                severity: 'medium',
                effort: 'hours',
                impact: 'Function is too complex and hard to read.',
                suggestion: 'Extract logic into smaller, reusable helper functions.'
             });
          }
          inFunction = false;
          functionLineCount = 0;
        }
      }
    });

    return items;
  }

  /**
   * Scans a project directory for technical debt.
   * @param projectPath - The root path of the project
   * @returns Array of technical debt items found across the project
   */
  async analyzeProject(projectPath: string): Promise<TechDebtItem[]> {
    let allItems: TechDebtItem[] = [];

    const scanDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('dist')) {
          scanDir(fullPath);
        } else if (stat.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.js'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          allItems = allItems.concat(this.analyzeFile(fullPath, content));
        }
      }
    };

    try {
      scanDir(projectPath);
      return allItems;
    } catch (error) {
      logger.error('Failed to analyze project', { error });
      throw new Error('Project analysis failed');
    }
  }

  /**
   * Calculates a health score based on the detected debt.
   * @param items - Array of technical debt items
   * @returns Score from 0 to 100
   */
  calculateDebtScore(items: TechDebtItem[]): number {
    let penalty = 0;
    items.forEach(item => {
      if (item.severity === 'critical') penalty += 10;
      else if (item.severity === 'high') penalty += 5;
      else if (item.severity === 'medium') penalty += 2;
      else if (item.severity === 'low') penalty += 1;
    });

    const score = Math.max(0, 100 - penalty);
    return score;
  }

  /**
   * Prioritizes debt items based on severity and impact.
   * @param items - Array of technical debt items
   * @returns Sorted array of debt items
   */
  prioritizeDebt(items: TechDebtItem[]): TechDebtItem[] {
    const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    
    return [...items].sort((a, b) => {
      return severityWeight[b.severity] - severityWeight[a.severity];
    });
  }

  /**
   * Generates a markdown report summarizing the technical debt.
   * @param items - Array of technical debt items
   * @returns Markdown string report
   */
  generateDebtReport(items: TechDebtItem[]): string {
    const score = this.calculateDebtScore(items);
    let report = `# Technical Debt Report\n\n`;
    report += `**Overall Health Score:** ${score}/100\n\n`;
    report += `## Issues Detected (${items.length})\n\n`;

    const prioritized = this.prioritizeDebt(items);

    prioritized.forEach(item => {
      report += `### [${item.severity.toUpperCase()}] ${item.type} in \`${item.file}\`${item.line ? ` at line ${item.line}` : ''}\n`;
      report += `- **Impact:** ${item.impact}\n`;
      report += `- **Effort:** ${item.effort}\n`;
      report += `- **Suggestion:** ${item.suggestion}\n\n`;
    });

    return report;
  }
}
